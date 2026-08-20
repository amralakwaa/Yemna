import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { StoriesService } from "./stories.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    story: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ id: "story-1", authorId: "user-1" })),
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "story-1", ...data })),
      delete: vi.fn(async () => undefined),
    },
    mediaAsset: { findFirst: vi.fn(async () => ({ id: "asset-1" })) },
  };
}

describe("StoriesService", () => {
  it("يعرض القصص النشطة فقط", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never);
    await service.list();
    expect(prisma.story.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { expiresAt: { gt: expect.any(Date) } } }));
  });

  it("ينشئ قصة بصور وفيديوهات يملكها المستخدم وغير مرتبطة بمحتوى آخر", async () => {
    const prisma = makePrisma();
    const service = new StoriesService(prisma as never);
    await service.create("user-1", { mediaId: "asset-1", caption: "  لحظة من صنعاء  " });
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "asset-1", ownerId: "user-1", postId: null, story: null }) }));
    expect(prisma.story.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "user-1", mediaId: "asset-1", caption: "لحظة من صنعاء", expiresAt: expect.any(Date) }) }));
  });

  it("يرفض استخدام وسيط لا يملكه المستخدم", async () => {
    const prisma = makePrisma();
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    const service = new StoriesService(prisma as never);
    await expect(service.create("user-1", { mediaId: "asset-2" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("يرفض عرض قصة انتهت مدتها", async () => {
    const prisma = makePrisma();
    prisma.story.findFirst.mockResolvedValue(null);
    const service = new StoriesService(prisma as never);
    await expect(service.get("story-old")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("يرفض الوصول عند غياب إعداد قاعدة البيانات", async () => {
    const service = new StoriesService(makePrisma(false) as never);
    expect(() => service.list()).toThrow(ServiceUnavailableException);
  });
});
