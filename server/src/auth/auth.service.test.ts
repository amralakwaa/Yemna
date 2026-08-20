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
      create: vi.fn(async () => user),
      update: vi.fn(async () => user),
    },
    authSession: {
      create: vi.fn(async () => ({ id: "session-1" })),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({ id: "session-1" })),
    },
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
});
