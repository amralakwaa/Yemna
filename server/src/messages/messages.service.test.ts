import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MessagesService } from "./messages.service";

function makePrisma(configured = true) {
  return { isConfigured: vi.fn(() => configured), user: { findMany: vi.fn(async () => [{ id: "user-1" }, { id: "user-2" }]) }, conversation: { create: vi.fn(async ({ data }: { data: object }) => ({ id: "conversation-1", ...data })), update: vi.fn() }, conversationParticipant: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => ({ id: "membership-1" })), update: vi.fn() }, message: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: "message-1" })) }, $transaction: vi.fn(async values => values) };
}
describe("MessagesService", () => {
  it("يرفض عند غياب قاعدة البيانات", async () => { await expect(new MessagesService(makePrisma(false) as never).conversations("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException); });
  it("ينشئ محادثة مباشرة مع المشاركين", async () => { const prisma = makePrisma(); await new MessagesService(prisma as never).create("user-1", { participantIds: ["user-2"] }); expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "DIRECT", createdById: "user-1" }) })); });
});
