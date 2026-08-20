import { afterEach, describe, expect, it, vi } from "vitest";
import { connectRealtime, realtimeTestApi, subscribeRealtimeStatus } from "../../../client/src/lib/realtime";

type Handler = (...args: any[]) => void;

function fakeSocket() {
  const handlers = new Map<string, Handler>();
  const instance = {
    auth: {},
    active: false,
    connected: false,
    on: vi.fn((name: string, handler: Handler) => { handlers.set(name, handler); return instance; }),
    connect: vi.fn(() => instance),
    disconnect: vi.fn(() => instance),
    emitEvent(name: string, ...args: any[]) { handlers.get(name)?.(...args); },
  };
  return instance;
}

describe("عميل الاتصال اللحظي", () => {
  afterEach(() => realtimeTestApi.reset());

  it("يرسل رمز المستخدم ويعرض الاتصال وإعادة الاتصال والحالة غير المتصلة", () => {
    const socket = fakeSocket();
    const statuses: string[] = [];
    realtimeTestApi.setSocketFactory(() => socket as never);
    const unsubscribe = subscribeRealtimeStatus(status => statuses.push(status));

    connectRealtime("signed-access-token");
    expect(socket.auth).toEqual({ token: "signed-access-token" });
    expect(socket.connect).toHaveBeenCalledOnce();
    socket.emitEvent("connect");
    socket.emitEvent("disconnect", "transport close");
    socket.emitEvent("reconnect_attempt");
    socket.emitEvent("reconnect_failed");

    expect(statuses).toEqual(["offline", "connecting", "connected", "reconnecting", "offline"]);
    unsubscribe();
  });
});
