import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    user: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "user-1", ...data })),
    },
    userSettings: { upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => create) },
  };
}

describe("UsersService", () => {
  it("يرفض طلبات الملف عندما لا تكون قاعدة البيانات مهيأة", async () => {
    const service = new UsersService(makePrisma(false) as never);
    await expect(service.me("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("يعيد الملف الخاص للحساب الحالي ويرفض الحساب غير الموجود", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", displayName: "مستخدم", email: "user@yemna.test", settings: null });
    const service = new UsersService(prisma as never);
    await expect(service.me("user-1")).resolves.toEqual(expect.objectContaining({ email: "user@yemna.test" }));
    await expect(service.me("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("يعيد الملف العام دون تضمين حقول الاتصال الخاصة", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", username: "test-user", displayName: "مستخدم" });
    const service = new UsersService(prisma as never);
    await expect(service.byUsername("test-user")).resolves.toEqual(expect.not.objectContaining({ email: expect.anything(), phone: expect.anything() }));
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { username: "test-user" } }));
  });

  it("يحدّث الملف والإعدادات بمعرف الحساب المصادق عليه", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", displayName: "مستخدم" });
    const service = new UsersService(prisma as never);
    await service.updateMe("user-1", { displayName: "اسم جديد" });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" }, data: { displayName: "اسم جديد" } }));
    await service.updateSettings("user-1", { allowDirectMessages: false });
    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, create: { userId: "user-1", allowDirectMessages: false } }));
  });
});
