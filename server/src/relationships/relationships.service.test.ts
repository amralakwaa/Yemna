import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RelationshipsService } from "./relationships.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    user: { findUnique: vi.fn(async () => ({ id: "user-2" })), findMany: vi.fn(async () => []) },
    block: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), upsert: vi.fn(), deleteMany: vi.fn() },
    friendship: { findFirst: vi.fn(async () => null), findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: object }) => ({ id: "friendship-1", ...data })), update: vi.fn(), deleteMany: vi.fn() },
    follow: { upsert: vi.fn(async ({ create }: { create: object }) => ({ id: "follow-1", ...create })), deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async () => []),
  };
}

describe("RelationshipsService", () => {
  it("يرفض الوصول عند غياب إعداد قاعدة البيانات", async () => {
    const service = new RelationshipsService(makePrisma(false) as never);
    await expect(service.suggestions("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("ينشئ طلب صداقة بعد التحقق من المستخدم والحظر", async () => {
    const prisma = makePrisma();
    const service = new RelationshipsService(prisma as never);
    await service.sendFriendRequest("user-1", "user-2");
    expect(prisma.friendship.create).toHaveBeenCalledWith({ data: { requesterId: "user-1", recipientId: "user-2" } });
  });

  it("ينشئ متابعة واحدة قابلة للإعادة دون تكرار", async () => {
    const prisma = makePrisma();
    const service = new RelationshipsService(prisma as never);
    await service.follow("user-1", "user-2");
    expect(prisma.follow.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { followerId_followedId: { followerId: "user-1", followedId: "user-2" } },
      create: { followerId: "user-1", followedId: "user-2" },
    }));
  });

  it("يتعامل مع قاعدة قديمة تفتقد أعمدة صلاحيات العلاقات كافتراض EVERYONE", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockRejectedValueOnce(new Error("The column UserSettings.friendRequestPermission does not exist"));
    const service = new RelationshipsService(prisma as never);
    await expect(service.sendFriendRequest("user-1", "user-2")).resolves.toMatchObject({ requesterId: "user-1", recipientId: "user-2" });
    expect(prisma.friendship.create).toHaveBeenCalled();
  });

  it("يتعامل مع غياب أعمدة المتابعة الاختيارية دون تعطيل زر المتابعة", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockRejectedValueOnce(new Error("column UserSettings.followPermission is missing"));
    const service = new RelationshipsService(prisma as never);
    await expect(service.follow("user-1", "user-2")).resolves.toMatchObject({ followerId: "user-1", followedId: "user-2" });
    expect(prisma.follow.upsert).toHaveBeenCalled();
  });

  it("يزيل العلاقات المتبادلة عند حظر مستخدم", async () => {
    const prisma = makePrisma();
    const service = new RelationshipsService(prisma as never);
    await expect(service.block("user-1", "user-2")).resolves.toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.friendship.deleteMany).toHaveBeenCalledOnce();
    expect(prisma.follow.deleteMany).toHaveBeenCalledOnce();
  });

  it("يعرض كل الحسابات النشطة في الاقتراحات مع استبعاد الذات والمحظورين", async () => {
    const prisma = makePrisma();
    const service = new RelationshipsService(prisma as never);
    await service.suggestions("user-1");
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { notIn: ["user-1"] }, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }));
    expect(prisma.friendship.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
      select: { requesterId: true, recipientId: true, status: true },
    }));
    expect(prisma.follow.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { followerId: "user-1" },
    }));
  });
});

  it("يمنع طلب الصداقة عندما يختار صاحب الحساب لا أحد", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockResolvedValueOnce({ id: "user-2", settings: { friendRequestPermission: "NOBODY", followPermission: "EVERYONE" } });
    const service = new RelationshipsService(prisma as never);
    await expect(service.sendFriendRequest("user-1", "user-2")).rejects.toThrow("لا يستقبل هذا الحساب");
    expect(prisma.friendship.create).not.toHaveBeenCalled();
  });

  it("يسمح بالمتابعة من الأصدقاء فقط عند وجود صداقة مقبولة", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockResolvedValueOnce({ id: "user-2", settings: { friendRequestPermission: "EVERYONE", followPermission: "FRIENDS" } });
    const service = new RelationshipsService(prisma as never);
    await expect(service.follow("user-1", "user-2")).rejects.toThrow("يسمح هذا الحساب بالمتابعة");
    expect(prisma.follow.upsert).not.toHaveBeenCalled();
  });
