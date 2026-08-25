import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RelationshipsService } from "./relationships.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    user: { findUnique: vi.fn(async () => ({ id: "user-2" })), findMany: vi.fn(async () => []) },
    block: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), upsert: vi.fn(), deleteMany: vi.fn() },
    friendship: { findFirst: vi.fn(async () => null), findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: object }) => ({ id: "friendship-1", ...data })), update: vi.fn(), deleteMany: vi.fn() },
    follow: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: object }) => ({ id: "follow-1", ...data })), upsert: vi.fn(async ({ create }: { create: object }) => ({ id: "follow-1", ...create })), deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
    friendSuggestionDismissal: { findMany: vi.fn(async () => []), upsert: vi.fn(async ({ create }: { create: object }) => ({ id: "dismissal-1", ...create })) },
    $transaction: vi.fn(async () => []),
  };
}

function makeService(prisma = makePrisma()) {
  return new RelationshipsService(prisma as never, {
    create: vi.fn(async () => ({ id: "notification-1" })),
    removeBySourceKey: vi.fn(async () => ({ count: 0 })),
  } as never);
}

describe("RelationshipsService", () => {
  it("يرفض الوصول عند غياب إعداد قاعدة البيانات", async () => {
    const service = makeService(makePrisma(false));
    await expect(service.suggestions("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("ينشئ طلب صداقة بعد التحقق من المستخدم والحظر", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.sendFriendRequest("user-1", "user-2");
    expect(prisma.friendship.create).toHaveBeenCalledWith({ data: { requesterId: "user-1", recipientId: "user-2" } });
  });

  it("ينشئ متابعة متبادلة تلقائياً عند قبول طلب الصداقة", async () => {
    const prisma = makePrisma();
    prisma.friendship.findUnique.mockResolvedValue({ id: "friendship-1", requesterId: "user-2", recipientId: "user-1", status: "PENDING" });
    prisma.friendship.update.mockResolvedValue({ id: "friendship-1", status: "ACCEPTED" });
    const service = makeService(prisma);
    await service.respondToFriendRequest("user-1", "friendship-1", "accept");
    expect(prisma.follow.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.follow.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { followerId: "user-1", followedId: "user-2" } }));
    expect(prisma.follow.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { followerId: "user-2", followedId: "user-1" } }));
  });

  it("يعرض الطلبات الصادرة للمُرسِل مع بيانات المستلم", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.listOutgoingRequests("user-1");
    expect(prisma.friendship.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requesterId: "user-1", status: "PENDING" },
      include: expect.objectContaining({ recipient: expect.any(Object) }),
      orderBy: { createdAt: "desc" },
    }));
  });

  it("يلغي الطلب الصادر المعلّق فقط مع الاحتفاظ بالسجل التاريخي", async () => {
    const prisma = makePrisma();
    prisma.friendship.findUnique.mockResolvedValue({ id: "friendship-1", requesterId: "user-1", recipientId: "user-2", status: "PENDING" });
    prisma.friendship.update.mockResolvedValue({ id: "friendship-1", status: "CANCELLED" });
    const service = makeService(prisma);
    await expect(service.cancelOutgoingFriendRequest("user-1", "friendship-1")).resolves.toMatchObject({ status: "CANCELLED" });
    expect(prisma.friendship.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "friendship-1" },
      data: { status: "CANCELLED", respondedAt: expect.any(Date) },
    }));
  });

  it("يرفض إلغاء طلب لا يملكه المُرسِل أو لم يعد معلقاً", async () => {
    const prisma = makePrisma();
    prisma.friendship.findUnique.mockResolvedValue({ id: "friendship-1", requesterId: "user-2", recipientId: "user-3", status: "PENDING" });
    const service = makeService(prisma);
    await expect(service.cancelOutgoingFriendRequest("user-1", "friendship-1")).rejects.toThrow("غير متاح للإلغاء");
    expect(prisma.friendship.update).not.toHaveBeenCalled();
  });

  it("يحفظ تجاهل الاقتراح بصورة دائمة وقابلة للإعادة", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.dismissSuggestion("user-1", "user-2");
    expect(prisma.friendSuggestionDismissal.upsert).toHaveBeenCalledWith({
      where: { dismissingUserId_dismissedUserId: { dismissingUserId: "user-1", dismissedUserId: "user-2" } },
      create: { dismissingUserId: "user-1", dismissedUserId: "user-2" },
      update: {},
    });
  });

  it("يستبعد الاقتراحات المخفية من الاستعلام الخادمي", async () => {
    const prisma = makePrisma();
    prisma.friendSuggestionDismissal.findMany.mockResolvedValue([{ dismissedUserId: "hidden-user" }]);
    const service = makeService(prisma);
    await service.suggestions("user-1");
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { notIn: ["user-1", "hidden-user"] }, status: "ACTIVE" },
    }));
  });

  it("يحسب الأصدقاء المشتركين من صداقات مقبولة فعلية فقط", async () => {
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValue([{ id: "candidate-1", displayName: "مرشح", fullName: null, username: "candidate", avatarUrl: null, bio: null, city: null, governorate: null }]);
    prisma.friendship.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { requesterId: "user-1", recipientId: "shared-friend" },
        { requesterId: "candidate-1", recipientId: "shared-friend" },
        { requesterId: "candidate-1", recipientId: "unrelated-user" },
      ]);
    const service = makeService(prisma);
    await expect(service.suggestions("user-1")).resolves.toEqual([expect.objectContaining({ id: "candidate-1", mutualCount: 1 })]);
  });

  it("يعرض قائمة الأصدقاء المشتركين من تقاطع الصداقات المقبولة فقط", async () => {
    const prisma = makePrisma();
    prisma.friendship.findMany.mockResolvedValue([
      { requesterId: "user-1", recipientId: "shared-friend" },
      { requesterId: "shared-friend", recipientId: "user-2" },
      { requesterId: "user-1", recipientId: "actor-only" },
      { requesterId: "target-only", recipientId: "user-2" },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: "shared-friend", displayName: "صديق مشترك", fullName: null, username: "shared", avatarUrl: "https://cdn.example/avatar.jpg", bio: null, city: null, governorate: null }]);
    const service = makeService(prisma);
    await expect(service.listMutualFriends("user-1", "user-2")).resolves.toEqual([expect.objectContaining({ id: "shared-friend", displayName: "صديق مشترك" })]);
    expect(prisma.friendship.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "ACCEPTED", OR: expect.any(Array) }),
      select: { requesterId: true, recipientId: true },
    }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["shared-friend"] }, status: "ACTIVE" },
    }));
  });

  it("ينشئ متابعة واحدة قابلة للإعادة دون تكرار", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.follow("user-1", "user-2");
    expect(prisma.follow.findUnique).toHaveBeenCalledWith({ where: { followerId_followedId: { followerId: "user-1", followedId: "user-2" } } });
    expect(prisma.follow.create).toHaveBeenCalledWith({ data: { followerId: "user-1", followedId: "user-2" } });
  });

  it("يتعامل مع قاعدة قديمة تفتقد أعمدة صلاحيات العلاقات كافتراض EVERYONE", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockRejectedValueOnce(new Error("The column UserSettings.friendRequestPermission does not exist"));
    const service = makeService(prisma);
    await expect(service.sendFriendRequest("user-1", "user-2")).resolves.toMatchObject({ requesterId: "user-1", recipientId: "user-2" });
    expect(prisma.friendship.create).toHaveBeenCalled();
  });

  it("يتعامل مع غياب أعمدة المتابعة الاختيارية دون تعطيل زر المتابعة", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockRejectedValueOnce(new Error("column UserSettings.followPermission is missing"));
    const service = makeService(prisma);
    await expect(service.follow("user-1", "user-2")).resolves.toMatchObject({ followerId: "user-1", followedId: "user-2" });
    expect(prisma.follow.create).toHaveBeenCalled();
  });

  it("يزيل العلاقات المتبادلة عند حظر مستخدم", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(service.block("user-1", "user-2")).resolves.toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.friendship.deleteMany).toHaveBeenCalledOnce();
    expect(prisma.follow.deleteMany).toHaveBeenCalledOnce();
  });

  it("يعرض كل الحسابات النشطة في الاقتراحات مع استبعاد الذات والمحظورين", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.suggestions("user-1");
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { notIn: ["user-1"] }, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }));
    expect(prisma.friendship.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
      select: { requesterId: true, recipientId: true, status: true },
    }));
    expect(prisma.follow.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { followerId: "user-1" } }));
    expect(prisma.friendSuggestionDismissal.findMany).toHaveBeenCalledWith({ where: { dismissingUserId: "user-1" }, select: { dismissedUserId: true } });
  });

  it("يمنع طلب الصداقة عندما يختار صاحب الحساب لا أحد", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockResolvedValueOnce({ id: "user-2", settings: { friendRequestPermission: "NOBODY", followPermission: "EVERYONE" } });
    const service = makeService(prisma);
    await expect(service.sendFriendRequest("user-1", "user-2")).rejects.toThrow("لا يستقبل هذا الحساب");
    expect(prisma.friendship.create).not.toHaveBeenCalled();
  });

  it("يسمح بالمتابعة من الأصدقاء فقط عند وجود صداقة مقبولة", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-2" })
      .mockResolvedValueOnce({ id: "user-2", settings: { friendRequestPermission: "EVERYONE", followPermission: "FRIENDS" } });
    const service = makeService(prisma);
    await expect(service.follow("user-1", "user-2")).rejects.toThrow("يسمح هذا الحساب بالمتابعة");
    expect(prisma.follow.upsert).not.toHaveBeenCalled();
  });
});
