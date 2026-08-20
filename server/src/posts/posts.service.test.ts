import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
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
    reaction: { findFirst: vi.fn(async () => null), delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    comment: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: "comment-1" })), update: vi.fn(async ({ data }: { data: unknown }) => ({ id: "comment-1", ...data })), delete: vi.fn(async () => undefined), findMany: vi.fn(async () => []) },
    savedPost: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: "saved-1" })), delete: vi.fn() },
    $transaction: vi.fn(async () => []),
  };
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

  it("يرفض منشوراً بلا نص أو وسائط", async () => {
    const service = new PostsService(makePrisma() as never);
    await expect(service.create("user-1", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("يستبدل تفاعل المستخدم بدلاً من تجميع عدة تفاعلات", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    const result = await service.react("user-1", "post-1", { type: ReactionType.LIKE });
    expect(result).toEqual({ active: true, type: ReactionType.LIKE });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("ينشئ تعليقاً مرتبطاً بالمنشور والمستخدم المصادق عليه", async () => {
    const prisma = makePrisma();
    const service = new PostsService(prisma as never);
    await service.comment("user-1", "post-1", { body: "تعليق تجريبي" });
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "user-1", postId: "post-1", body: "تعليق تجريبي" }) }));
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
