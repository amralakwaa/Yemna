import { describe, expect, it, vi } from "vitest";
import { RealtimeGateway } from "./realtime.gateway";

describe("RealtimeGateway", () => {
  it("ينضم المستخدم الموثق إلى غرفته الخاصة", async () => {
    const jwt = { verifyAsync: vi.fn(async () => ({ sub: "user-1", role: "USER", sessionId: "session-1" })) };
    const events = { subscribe: vi.fn(() => vi.fn()) };
    const gateway = new RealtimeGateway(jwt as never, { get: vi.fn(() => "test-secret") } as never, events as never);
    const client = { handshake: { auth: { token: "token" }, headers: {} }, data: {}, join: vi.fn(async () => undefined), emit: vi.fn(), disconnect: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith("user:user-1");
    expect(client.emit).toHaveBeenCalledWith("realtime:ready", { userId: "user-1" });
  });

  it("يرفض الاتصال من دون رمز", async () => {
    const gateway = new RealtimeGateway({ verifyAsync: vi.fn() } as never, { get: vi.fn() } as never, { subscribe: vi.fn() } as never);
    const client = { handshake: { auth: {}, headers: {} }, data: {}, join: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.emit).toHaveBeenCalledWith("realtime:error", expect.objectContaining({ code: "UNAUTHORIZED" }));
  });
});
