import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { StoriesService } from "./stories.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    story: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ id: "story-1", authorId: "user-1", author: { id: "user-1" } })),
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "story-1", ...data })),
      delete: vi.fn(async () => undefined),
    },
    storyView: {
      upsert: vi.fn(async () => undefined),
      findMany: vi.fn(async () => [{ viewedAt: new Date(), viewer: { id: "user-2", displayName: "ندى" } }]),
    },
    mediaAsset: { findFirst: vi.fn(async () => ({ id: "asset-1" })) },
  };
}

function makeMessages() {
  return {
    findOrCreateDirectConversation: vi.fn(async () => ({ id: "conversation-1" })),
    send: vi.fn(async () => ({ id: "message-1" })),
  };
}

describe("StoriesService", () => {
  it("يعرض القصص النشطة فقط", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await service.list();
    expect(prisma.story.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { expiresAt: { gt: expect.any(Date) } } }));
  });

  it("ينشئ قصة بصور وفيديوهات يملكها المستخدم وغير مرتبطة بمحتوى آخر", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await service.create("user-1", { mediaId: "asset-1", caption: "  لحظة من صنعاء  " });
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "asset-1", ownerId: "user-1", postId: null, story: null }) }));
    expect(prisma.story.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "user-1", mediaId: "asset-1", caption: "لحظة من صنعاء", expiresAt: expect.any(Date) }) }));
  });

  it("يرفض استخدام وسيط لا يملكه المستخدم", async () => {
    const prisma = makePrisma();
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await expect(service.create("user-1", { mediaId: "asset-2" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("يسجل مشاهدة واحدة لكل حساب ويحدّث وقتها عند تكرارها", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await expect(service.recordView("user-2", "story-1")).resolves.toEqual({ success: true, recorded: true });
    expect(prisma.storyView.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { storyId_viewerId: { storyId: "story-1", viewerId: "user-2" } } }));
  });

  it("يمنح صاحب القصة وحده قائمة المشاهدين", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await expect(service.viewers("user-2", "story-1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.viewers("user-1", "story-1")).resolves.toMatchObject({ count: 1 });
  });

  it("يرسل الرد على القصة كرسالة مباشرة لصاحبها", async () => {
    const prisma = makePrisma();
    const messages = makeMessages();
    const service = new StoriesService(prisma as never, messages as never);
    await service.reply("user-2", "story-1", { body: "  لقطة جميلة  " });
    expect(messages.findOrCreateDirectConversation).toHaveBeenCalledWith("user-2", "user-1");
    expect(messages.send).toHaveBeenCalledWith("user-2", "conversation-1", { body: "لقطة جميلة" });
  });

  it("يمنع حذف القصة من غير مالكها ويسمح للمالك بحذفها", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await expect(service.remove("user-2", "story-1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove("user-1", "story-1")).resolves.toEqual({ success: true });
    expect(prisma.story.delete).toHaveBeenCalledWith({ where: { id: "story-1" } });
  });

  it("يرفض عرض قصة انتهت مدتها", async () => {
    const prisma = makePrisma();
    prisma.story.findFirst.mockResolvedValue(null);
    const service = new StoriesService(prisma as never, makeMessages() as never);
    await expect(service.get("story-old")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("يرفض الوصول عند غياب إعداد قاعدة البيانات", async () => {
    const service = new StoriesService(makePrisma(false) as never, makeMessages() as never);
    expect(() => service.list()).toThrow(ServiceUnavailableException);
  });
});
