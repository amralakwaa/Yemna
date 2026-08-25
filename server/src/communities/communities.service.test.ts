import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CommunitiesService } from "./communities.service";

function makePrisma(configured = true) {
  const client = {
    isConfigured: vi.fn(() => configured),
    community: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: "community-1", ...data })),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: "community-1", ...data })),
    },
    communityMember: {
      upsert: vi.fn(async () => ({ id: "member-1" })),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: "member-2", ...data })),
    },
    conversation: {
      create: vi.fn(async () => ({ id: "conversation-1" })),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(async () => ({ id: "conversation-1", kind: "GROUP", participants: [] })),
    },
    conversationParticipant: { upsert: vi.fn(), deleteMany: vi.fn() },
  };
  return { ...client, $transaction: vi.fn(async (callback: (tx: typeof client) => unknown) => callback(client)) };
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

  it("ينشئ مجتمعاً مع محادثة GROUP ثابتة وعضوية المالك الإدارية", async () => {
    const prisma = makePrisma();
    const service = new CommunitiesService(prisma as never);
    await service.create("user-1", { name: "مجتمع صنعاء", slug: "sanaa-community", visibility: "PUBLIC" });
    expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "GROUP", createdById: "user-1", participants: { create: { userId: "user-1" } } }) }));
    expect(prisma.community.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: "user-1", conversationId: "conversation-1", members: { create: { userId: "user-1", role: "ADMIN" } } }) }));
  });

  it("يزامن مشارك المحادثة عند الانضمام", async () => {
    const prisma = makePrisma();
    prisma.community.findUnique.mockResolvedValueOnce({ id: "community-1", name: "صنعاء", ownerId: "owner-1", visibility: "PUBLIC", conversationId: "conversation-1" });
    await new CommunitiesService(prisma as never).join("user-2", "community-1");
    expect(prisma.communityMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { communityId_userId: { communityId: "community-1", userId: "user-2" } } }));
    expect(prisma.conversationParticipant.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId_userId: { conversationId: "conversation-1", userId: "user-2" } } }));
  });

  it("يحذف العضوية ومشارك المحادثة عند المغادرة", async () => {
    const prisma = makePrisma();
    prisma.community.findUnique.mockResolvedValueOnce({ id: "community-1", name: "صنعاء", ownerId: "owner-1", conversationId: "conversation-1" });
    await expect(new CommunitiesService(prisma as never).leave("user-2", "community-1")).resolves.toEqual({ success: true });
    expect(prisma.communityMember.deleteMany).toHaveBeenCalledWith({ where: { communityId: "community-1", userId: "user-2" } });
    expect(prisma.conversationParticipant.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "conversation-1", userId: "user-2" } });
  });

  it("يحمي المالك من المغادرة أو الإزالة", async () => {
    const prisma = makePrisma();
    prisma.community.findUnique.mockResolvedValueOnce({ id: "community-1", name: "صنعاء", ownerId: "owner-1", conversationId: "conversation-1" });
    await expect(new CommunitiesService(prisma as never).leave("owner-1", "community-1")).rejects.toBeInstanceOf(BadRequestException);
    prisma.community.findUnique.mockResolvedValueOnce({ id: "community-1", name: "صنعاء", ownerId: "owner-1", conversationId: "conversation-1" });
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: "ADMIN" }).mockResolvedValueOnce({ role: "ADMIN" });
    await expect(new CommunitiesService(prisma as never).removeMember("owner-1", "community-1", "owner-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("يقصر تعديل الإعدادات وتغيير الأدوار على المالك", async () => {
    const prisma = makePrisma();
    prisma.community.findUnique.mockResolvedValueOnce({ ownerId: "owner-1" }).mockResolvedValueOnce({ ownerId: "owner-1" });
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: "MODERATOR" }).mockResolvedValueOnce({ role: "MODERATOR" });
    const service = new CommunitiesService(prisma as never);
    await expect(service.update("user-2", "community-1", { name: "اسم جديد" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setMemberRole("user-2", "community-1", "user-3", { role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("يسمح للمالك بتحديث دور عضو ويمنع مديراً من إزالة مدير آخر", async () => {
    const prisma = makePrisma();
    prisma.community.findUnique.mockResolvedValueOnce({ ownerId: "owner-1" });
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: "ADMIN" }).mockResolvedValueOnce({ id: "member-2", userId: "user-2", role: "MEMBER", user: {} });
    await new CommunitiesService(prisma as never).setMemberRole("owner-1", "community-1", "user-2", { role: "MODERATOR" });
    expect(prisma.communityMember.update).toHaveBeenCalledWith(expect.objectContaining({ data: { role: "MODERATOR" } }));

    prisma.community.findUnique.mockResolvedValueOnce({ id: "community-1", name: "صنعاء", ownerId: "owner-1", conversationId: "conversation-1" });
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: "MODERATOR" }).mockResolvedValueOnce({ role: "MODERATOR" });
    await expect(new CommunitiesService(prisma as never).removeMember("moderator-1", "community-1", "moderator-2")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
