import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { PostVisibility, ReactionType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PostsService } from "./posts.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ id: "post-1", authorId: "user-1", status: "PUBLISHED" })),
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "post-1", ...data })),
      update: vi.fn(async ({ data }: { data: unknown }) => ({ id: "post-1", ...data })),
    },
    mediaAsset: { findMany: vi.fn(async () => []) },
    reaction: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []), delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    commentReaction: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn() },
    comment: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: "comment-1" })), update: vi.fn(async ({ data }: { data: unknown }) => ({ id: "comment-1", ...data })), delete: vi.fn(async () => undefined), findMany: vi.fn(async () => []) },
    commentHide: { findMany: vi.fn(async () => []), upsert: vi.fn(async () => ({ id: "hide-1" })), deleteMany: vi.fn(async () => ({ count: 1 })) },
    savedPost: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: "saved-1" })), delete: vi.fn() },
    $transaction: vi.fn(async () => []),
  };
}

function makeNotifications() {
  return { create: vi.fn(async () => ({ id: "notification-1" })), removeBySourceKey: vi.fn(async () => undefined) };
}

describe("PostsService", () => {
  it("يرفض الوصول عند غياب إعداد قاعدة البيانات", async () => {
    const service = new PostsService(makePrisma(false) as never);
    await expect(service.feed({})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("ينشئ منشوراً عاماً للمستخدم المصادق عليه", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    await service.create("user-1", { body: "منشور تجريبي", visibility: PostVisibility.PUBLIC });
    expect(prisma.post.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "user-1", body: "منشور تجريبي" }) }));
  });

  it("يربط فقط الوسائط المرفوعة وغير المرتبطة التي يملكها ناشر المنشور", async () => {
    const prisma = makePrisma();
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: "asset-1" }]);
    const service = new PostsService(prisma as never);
    await service.create("user-1", { body: "منشور بصورة", mediaIds: ["asset-1"] });
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({ where: { id: { in: ["asset-1"] }, ownerId: "user-1", postId: null }, select: { id: true } });
    expect(prisma.post.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ media: { connect: [{ id: "asset-1" }] } }) }));
  });

  it("يرفض ربط وسيط لا يملكه المستخدم أو مرتبط مسبقاً بمنشور", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    await expect(service.create("user-1", { body: "منشور بصورة", mediaIds: ["asset-1"] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it("يرفض منشوراً بلا نص أو وسائط", async () => {
    const service = new PostsService(makePrisma() as never);
    await expect(service.create("user-1", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("يستبدل تفاعل المستخدم بدلاً من تجميع عدة تفاعلات", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    const result = await service.react("user-1", "post-1", { type: ReactionType.LIKE });
    expect(result).toEqual(expect.objectContaining({ active: true, type: ReactionType.LIKE, engagement: expect.objectContaining({ viewerReaction: null }) }));
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("يلغي التفاعل نفسه مع تنظيف كل تفاعلات المستخدم السابقة على المنشور", async () => {
    const prisma = makePrisma();
    prisma.reaction.findFirst.mockResolvedValue({ id: "reaction-1", type: ReactionType.LOVE });
    const service = new PostsService(prisma as never);
    const result = await service.react("user-1", "post-1", { type: ReactionType.LOVE });
    expect(result).toEqual(expect.objectContaining({ active: false, type: ReactionType.LOVE }));
    expect(prisma.reaction.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", postId: "post-1" } });
  });

  it("يعيد ملخص الأنواع وحالة المشاهد والحفظ وقائمة معاينة المتفاعلين", async () => {
    const prisma = makePrisma();
    prisma.reaction.groupBy.mockResolvedValue([{ postId: "post-1", type: ReactionType.LOVE, _count: { _all: 2 } }]);
    prisma.reaction.findFirst.mockResolvedValue({ type: ReactionType.LOVE });
    prisma.reaction.findMany.mockResolvedValue([{ id: "reaction-1", type: ReactionType.LOVE, user: { id: "user-2", displayName: "مستخدم", username: "user", avatarUrl: null } }]);
    prisma.savedPost.findUnique.mockResolvedValue({ id: "saved-1" });
    const service = new PostsService(prisma as never);
    await expect(service.getEngagement("user-1", "post-1")).resolves.toEqual(expect.objectContaining({
      reactionSummary: expect.objectContaining({ LOVE: 2, LIKE: 0 }),
      reactionTotal: 2,
      viewerReaction: ReactionType.LOVE,
      saved: true,
      reactors: [expect.objectContaining({ id: "reaction-1" })],
    }));
  });

  it("يرفض إنشاء رد داخل رد للحفاظ على بنية تعليق واضحة", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "reply-1", postId: "post-1", parentId: "comment-1" });
    const service = new PostsService(prisma as never);
    await expect(service.comment("user-1", "post-1", { body: "رد متداخل", parentId: "reply-1" })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it("ينشئ تعليقاً مرتبطاً بالمنشور والمستخدم المصادق عليه", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    await service.comment("user-1", "post-1", { body: "تعليق تجريبي" });
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "user-1", postId: "post-1", body: "تعليق تجريبي" }) }));
  });

  it("ينشئ إشعار رد واحداً لكاتب التعليق الأب ولا يكرر إشعار المنشور عندما يكون المستلم نفسه", async () => {
    const prisma = makePrisma();
    const notifications = makeNotifications();
    prisma.post.findFirst.mockResolvedValue({ id: "post-1", authorId: "user-2", status: "PUBLISHED" });
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1", postId: "post-1", parentId: null, authorId: "user-2" });
    const service = new PostsService(prisma as never, notifications as never);
    await service.comment("user-1", "post-1", { body: "رد حقيقي", parentId: "comment-1" });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "user-2", type: "COMMENT_REPLY", sourceKey: "comment-reply:comment-1" }));
  });

  it("لا ينشئ إشعار رد ذاتياً عندما يرد المستخدم على تعليقه", async () => {
    const prisma = makePrisma();
    const notifications = makeNotifications();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1", postId: "post-1", parentId: null, authorId: "user-1" });
    const service = new PostsService(prisma as never, notifications as never);
    await service.comment("user-1", "post-1", { body: "متابعة", parentId: "comment-1" });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("يحفظ تفاعلاً واحداً للتعليق ويعيد موجزه وحالة المشاهد", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1" });
    prisma.commentReaction.groupBy.mockResolvedValue([{ commentId: "comment-1", type: ReactionType.LOVE, _count: { _all: 3 } }]);
    prisma.commentReaction.findFirst.mockResolvedValueOnce(null).mockResolvedValue({ type: ReactionType.LOVE });
    const service = new PostsService(prisma as never, makeNotifications() as never);
    await expect(service.reactToComment("user-1", "post-1", "comment-1", { type: ReactionType.LOVE })).resolves.toEqual(expect.objectContaining({ active: true, engagement: expect.objectContaining({ reactionTotal: 3, viewerReaction: ReactionType.LOVE }) }));
    expect(prisma.commentReaction.create).toHaveBeenCalledWith({ data: { userId: "user-1", commentId: "comment-1", type: ReactionType.LOVE } });
  });

  it("يلغي التفاعل نفسه على التعليق بدلاً من إضافة صف مكرر", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1" });
    prisma.commentReaction.findFirst.mockResolvedValue({ id: "comment-reaction-1", type: ReactionType.LIKE });
    const service = new PostsService(prisma as never, makeNotifications() as never);
    await expect(service.reactToComment("user-1", "post-1", "comment-1", { type: ReactionType.LIKE })).resolves.toEqual(expect.objectContaining({ active: false }));
    expect(prisma.commentReaction.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", commentId: "comment-1" } });
  });

  it("يفرز التعليقات الرئيسية الأكثر تفاعلاً عند طلب TOP مع بقاء الردود مرتبة زمنياً", async () => {
    const prisma = makePrisma();
    prisma.comment.findMany.mockResolvedValue([{ id: "comment-1", author: { id: "user-2" }, replies: [{ id: "reply-1", author: { id: "user-3" } }] }]);
    const service = new PostsService(prisma as never, makeNotifications() as never);
    await service.listComments("post-1", { sort: "TOP" });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ reactions: { _count: "desc" } }, { createdAt: "desc" }] }));
  });

  it("يعرض قائمة حقيقية لمتفاعلي تعليق المنشور المحدد", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1" });
    prisma.commentReaction.findMany.mockResolvedValue([{ id: "comment-reaction-1", type: ReactionType.LOVE, user: { id: "user-2", displayName: "مستخدم", username: "user", avatarUrl: null } }]);
    const service = new PostsService(prisma as never, makeNotifications() as never);
    await expect(service.listCommentReactions("post-1", "comment-1")).resolves.toEqual([expect.objectContaining({ id: "comment-reaction-1", type: ReactionType.LOVE })]);
    expect(prisma.commentReaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { commentId: "comment-1" }, take: 50 }));
  });

  it("يخفي المستخدم تعليقاً لنفسه فقط ثم يعيد إظهاره", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1" });
    const service = new PostsService(prisma as never, makeNotifications() as never);
    await expect(service.hideComment("user-1", "post-1", "comment-1")).resolves.toEqual({ hidden: true });
    expect(prisma.commentHide.upsert).toHaveBeenCalledWith({
      where: { userId_commentId: { userId: "user-1", commentId: "comment-1" } },
      create: { userId: "user-1", commentId: "comment-1" },
      update: {},
    });
    await expect(service.unhideComment("user-1", "post-1", "comment-1")).resolves.toEqual({ hidden: false });
    expect(prisma.commentHide.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", commentId: "comment-1" } });
  });

  it("يعيد فقط معرّفات التعليقات المخفية للمشاهد الحالي ضمن المنشور", async () => {
    const prisma = makePrisma();
    prisma.commentHide.findMany.mockResolvedValue([{ commentId: "comment-1" }, { commentId: "comment-2" }]);
    const service = new PostsService(prisma as never, makeNotifications() as never);
    await expect(service.getHiddenCommentIds("user-1", "post-1")).resolves.toEqual({ commentIds: ["comment-1", "comment-2"] });
    expect(prisma.commentHide.findMany).toHaveBeenCalledWith({ where: { userId: "user-1", comment: { postId: "post-1" } }, select: { commentId: true } });
  });

  it("يعدّل التعليق للمالك فقط ويحفظ النص الجديد", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1", postId: "post-1", authorId: "user-1" });
    const service = new PostsService(prisma as never);
    await service.updateComment("user-1", "post-1", "comment-1", { body: "نص محدّث" });
    expect(prisma.comment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "comment-1" }, data: { body: "نص محدّث" } }));
  });

  it("يرفض حذف تعليق لا يملكه المستخدم", async () => {
    const prisma = makePrisma();
    prisma.comment.findFirst.mockResolvedValue({ id: "comment-1", postId: "post-1", authorId: "user-2" });
    const service = new PostsService(prisma as never);
    await expect(service.removeComment("user-1", "post-1", "comment-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it("يحفظ المنشور للمستخدم عند عدم وجود سجل حفظ سابق", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    await expect(service.toggleSaved("user-1", "post-1")).resolves.toEqual({ saved: true });
    expect(prisma.savedPost.create).toHaveBeenCalledWith({ data: { userId: "user-1", postId: "post-1" } });
  });
});
