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
    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
  });
});
