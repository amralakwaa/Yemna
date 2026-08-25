import { describe, expect, it, vi } from "vitest";
import { RealtimeGateway } from "./realtime.gateway";

describe("RealtimeGateway", () => {
  function createGateway(options?: { member?: boolean; kind?: string; recipients?: { userId: string }[] }) {
    const jwt = { verifyAsync: vi.fn(async () => ({ sub: "user-1", role: "USER", sessionId: "session-1" })) };
    const events = { subscribe: vi.fn(() => vi.fn()), emit: vi.fn(async () => undefined) };
    const prisma = {
      isConfigured: vi.fn(() => true),
      conversation: { findUnique: vi.fn(async () => ({ kind: options?.kind ?? "DIRECT" })) },
      conversationParticipant: {
        findUnique: vi.fn(async () => options?.member === false ? null : ({ conversationId: "conversation-1" })),
        findMany: vi.fn(async () => options?.recipients ?? [{ userId: "user-2" }]),
      },
      user: { findUnique: vi.fn(async () => ({ displayName: "Caller", avatarUrl: null })) },
    };
    return { gateway: new RealtimeGateway(jwt as never, { get: vi.fn(() => "test-secret") } as never, events as never, prisma as never), jwt, events, prisma };
  }

  it("ينضم المستخدم الموثق إلى غرفته الخاصة", async () => {
    const { gateway } = createGateway();
    const client = { handshake: { auth: { token: "token" }, headers: {} }, data: {}, join: vi.fn(async () => undefined), emit: vi.fn(), disconnect: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith("user:user-1");
    expect(client.emit).toHaveBeenCalledWith("realtime:ready", { userId: "user-1" });
  });

  it("يرفض الاتصال من دون رمز", async () => {
    const gateway = new RealtimeGateway({ verifyAsync: vi.fn() } as never, { get: vi.fn() } as never, { subscribe: vi.fn() } as never, { isConfigured: vi.fn() } as never);
    const client = { handshake: { auth: {}, headers: {} }, data: {}, join: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.emit).toHaveBeenCalledWith("realtime:error", expect.objectContaining({ code: "UNAUTHORIZED" }));
  });

  it("يوجه دعوة المكالمة إلى المشارك الآخر ويعيد إقرار تسليم آمن", async () => {
    const { gateway, events } = createGateway();
    const client = { data: { user: { sub: "user-1" } } };

    const receipt = await gateway.callInvite(client as never, { conversationId: "conversation-1", callId: "call-1", mode: "audio", description: { type: "offer", sdp: "offer-sdp" } });

    expect(receipt).toEqual({ success: true, recipientCount: 1 });
    expect(events.emit).toHaveBeenCalledWith("user-2", "call:invite", expect.objectContaining({ conversationId: "conversation-1", callId: "call-1", mode: "audio", fromUserId: "user-1" }));
  });

  it("يرفض الدعوة التي لا يملك مرسلها عضوية في المحادثة من دون بثها", async () => {
    const { gateway, events } = createGateway({ member: false });
    const client = { data: { user: { sub: "user-1" } } };

    const receipt = await gateway.callInvite(client as never, { conversationId: "conversation-1", callId: "call-1", mode: "video" });

    expect(receipt).toEqual({ success: false, reason: "not_member", recipientCount: 0 });
    expect(events.emit).not.toHaveBeenCalled();
  });
});
