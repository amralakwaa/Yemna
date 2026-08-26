import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AccountStatus, AppRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

const user = {
  id: "user-1",
  displayName: "مستخدم اختبار",
  email: "user@yemna.test",
  phone: null,
  username: "test-user",
  passwordHash: "",
  role: AppRole.USER,
  status: AccountStatus.ACTIVE,
};

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    user: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => user),
      update: vi.fn(async () => user),
    },
    authSession: {
      create: vi.fn(async () => ({ id: "session-1" })),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({ id: "session-1" })),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (values: Promise<unknown>[]) => Promise.all(values)),
  };
}

function makeService(prisma = makePrisma()) {
  const config = {
    get: vi.fn((key: string) => {
      if (key === "YEMNA_REFRESH_TOKEN_DAYS") return 7;
      if (key === "YEMNA_JWT_ACCESS_TTL") return "15m";
      if (key === "YEMNA_JWT_ACCESS_SECRET") return "test-access-secret";
      return undefined;
    }),
  };
  const jwt = { signAsync: vi.fn(async () => "signed-access-token") };
  return { service: new AuthService(prisma as never, jwt as never, config as never), prisma, jwt };
}

describe("AuthService", () => {
  it("يحمّل دوال bcryptjs بالإدخال المتوافق مع تشغيل ESM", () => {
    expect(typeof bcrypt.hash).toBe("function");
    expect(typeof bcrypt.compare).toBe("function");
  });

  it("يرفض المصادقة عندما لا تكون قاعدة البيانات مهيأة", async () => {
    const { service } = makeService(makePrisma(false));
    await expect(service.login({ identifier: "user@yemna.test", password: "strong-password" }, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("يرفض التسجيل دون بريد إلكتروني أو هاتف", async () => {
    const { service } = makeService();
    await expect(service.register({ displayName: "مستخدم", password: "strong-password" }, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("ينشئ المستخدم والجلسة ويعيد رمز وصول عند التسجيل", async () => {
    const { service, prisma, jwt } = makeService();
    const result = await service.register({ displayName: "مستخدم اختبار", email: "user@yemna.test", password: "strong-password" }, { userAgent: "vitest" });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "user@yemna.test", displayName: "مستخدم اختبار" }) }));
    expect(prisma.authSession.create).toHaveBeenCalledOnce();
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: "user-1", role: AppRole.USER }), expect.any(Object));
    expect(result.accessToken).toBe("signed-access-token");
    expect(result.refreshToken).toMatch(/^session-1\./);
  });

  it("يرفض تسجيل الدخول عند عدم مطابقة كلمة المرور", async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ ...user, passwordHash: await bcrypt.hash("correct-password", 12) });
    const { service } = makeService(prisma);
    await expect(service.login({ identifier: "user@yemna.test", password: "wrong-password" }, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("يدوّر جلسة التحديث الفعالة ويلغيها عند الخروج", async () => {
    const prisma = makePrisma();
    const hash = await bcrypt.hash("refresh-secret", 12);
    prisma.authSession.findUnique.mockResolvedValue({ id: "session-old", tokenHash: hash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user });
    const { service } = makeService(prisma);
    await expect(service.refresh("session-old.refresh-secret", {})).resolves.toEqual(expect.objectContaining({ accessToken: "signed-access-token" }));
    expect(prisma.authSession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "session-old" }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }));
    await service.logout("session-old.refresh-secret");
    expect(prisma.authSession.update).toHaveBeenCalledTimes(2);
  });

  it("يعرض الجلسات الحية ببيانات جهاز آمنة من دون عنوان IP أو وكيل المتصفح", async () => {
    const prisma = makePrisma();
    prisma.authSession.findMany.mockResolvedValue([{ id: "session-current", deviceName: null, userAgent: "Mozilla/5.0 (Windows NT 10.0)", createdAt: new Date("2026-08-20T10:00:00.000Z"), lastActiveAt: new Date("2026-08-21T10:00:00.000Z"), expiresAt: new Date("2026-09-20T10:00:00.000Z") }]);
    const { service } = makeService(prisma);
    await expect(service.sessions("user-1", "session-current")).resolves.toEqual([expect.objectContaining({ id: "session-current", isCurrent: true, deviceName: "كمبيوتر يعمل بنظام Windows" })]);
    expect(prisma.authSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.not.objectContaining({ ipAddress: true, userAgent: true }) }));
  });

  it("ينهي جلسة أخرى فقط ويحمي الجلسة الحالية من الإنهاء غير المقصود", async () => {
    const { service, prisma } = makeService();
    await expect(service.revokeSession("user-1", "session-current", "session-other")).resolves.toEqual({ success: true });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "session-other", userId: "user-1", revokedAt: null } }));
    await expect(service.revokeSession("user-1", "session-current", "session-current")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("يغير كلمة المرور بعد تحقق الحالية وينهي الجلسات الأخرى", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", status: AccountStatus.ACTIVE, passwordHash: await bcrypt.hash("current-password", 12) });
    const { service } = makeService(prisma);
    await expect(service.changePassword("user-1", "session-current", { currentPassword: "current-password", newPassword: "new-strong-password" })).resolves.toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" }, data: expect.objectContaining({ passwordHash: expect.any(String), passwordChangedAt: expect.any(Date) }) }));
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", id: { not: "session-current" }, revokedAt: null } }));
  });
});
