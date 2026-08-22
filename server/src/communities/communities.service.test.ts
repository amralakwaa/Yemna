import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CommunitiesService } from "./communities.service";

function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    community: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: object }) => ({ id: "community-1", ...data })) },
    communityMember: { upsert: vi.fn(async () => ({ id: "member-1" })), deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
  };
}

describe("CommunitiesService", () => {
  it("يرفض القائمة عند غياب قاعدة البيانات", async () => {
    await expect(new CommunitiesService(makePrisma(false) as never).list()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it("يعرض مجموعات العضو من سجل عضويته الفعلي", async () => {
    const prisma = makePrisma();
    prisma.communityMember.findMany.mockResolvedValueOnce([{ community: { id: "community-1", name: "نادي القراءة" } }]);

    await expect(new CommunitiesService(prisma as never).listForUser("user-1")).resolves.toEqual([{ id: "community-1", name: "نادي القراءة" }]);
    expect(prisma.communityMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, orderBy: { joinedAt: "desc" } }));
  });
  it("ينشئ مجتمعاً ويضيف المالك مشرفاً", async () => {
    const prisma = makePrisma();
    const service = new CommunitiesService(prisma as never);
    await service.create("user-1", { name: "مجتمع صنعاء", slug: "sanaa-community", visibility: "PUBLIC" });
    expect(prisma.community.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: "user-1", members: { create: { userId: "user-1", role: "ADMIN" } } }) }));
  });
});
