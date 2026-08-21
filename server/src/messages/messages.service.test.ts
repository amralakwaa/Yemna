import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MessagesService } from "./messages.service";

function makePrisma(configured = true) {
  return { isConfigured: vi.fn(() => configured), user: { findMany: vi.fn(async () => [{ id: "user-1" }, { id: "user-2" }]) }, conversation: { create: vi.fn(async ({ data }: { data: object }) => ({ id: "conversation-1", ...data })), update: vi.fn() }, conversationParticipant: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => ({ id: "membership-1" })), update: vi.fn() }, message: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), create: vi.fn(async () => ({ id: "message-1" })) }, $transaction: vi.fn(async values => values) };
}
describe("MessagesService", () => {
  const realtime = { emit: vi.fn() };
  const notifications = { create: vi.fn() };
  it("يرفض عند غياب قاعدة البيانات", async () => { await expect(new MessagesService(makePrisma(false) as never, realtime as never, notifications as never).conversations("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException); });
  it("ينشئ محادثة مباشرة مع المشاركين", async () => { const prisma = makePrisma(); await new MessagesService(prisma as never, realtime as never, notifications as never).create("user-1", { participantIds: ["user-2"] }); expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "DIRECT", createdById: "user-1" }) })); });
  it("يعيد استخدام المحادثة المباشرة الموجودة", async () => { const prisma = makePrisma(); const existing = { id: "conversation-existing", participants: [] }; prisma.conversationParticipant.findFirst.mockResolvedValue({ conversation: existing }); const result = await new MessagesService(prisma as never, realtime as never, notifications as never).findOrCreateDirectConversation("user-1", "user-2"); expect(result).toBe(existing); expect(prisma.conversation.create).not.toHaveBeenCalled(); });
  it("يعيد عدد الرسائل غير المقروءة بعد آخر قراءة", async () => { const prisma = makePrisma(); prisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: "conversation-1", lastReadAt: new Date("2026-08-22T10:00:00.000Z"), conversation: { id: "conversation-1", participants: [], messages: [] } }]); prisma.message.count.mockResolvedValue(3); const result = await new MessagesService(prisma as never, realtime as never, notifications as never).conversations("user-1"); expect(result[0].unreadCount).toBe(3); expect(prisma.message.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ conversationId: "conversation-1", senderId: { not: "user-1" }, createdAt: { gt: new Date("2026-08-22T10:00:00.000Z") } }) })); });
});
