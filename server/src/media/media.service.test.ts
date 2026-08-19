import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MediaService } from "./media.service";
function makePrisma(configured = true) { return { isConfigured: vi.fn(() => configured), mediaAsset: { findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 1 })) }, album: { create: vi.fn(async ({ data }: { data: object }) => ({ id: "album-1", ...data })), findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) }, post: { findUnique: vi.fn() } }; }
describe("MediaService", () => {
  it("يرفض الوصول عند غياب قاعدة البيانات", async () => { await expect(new MediaService(makePrisma(false) as never).list("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException); });
  it("ينشئ ألبوماً مملوكاً للمستخدم الحالي", async () => { const prisma = makePrisma(); await new MediaService(prisma as never).createAlbum("user-1", { title: "صوري" }); expect(prisma.album.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: "user-1", title: "صوري" }) })); });
});
