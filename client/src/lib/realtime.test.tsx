import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import { clearRestAccessToken, setRestAccessToken } from "./api";
import { connectRealtime, emitCallSignal, realtimeTestApi, useRealtimeSubscription } from "./realtime";

function SubscriptionProbe({ onEvent }: { onEvent: (event: unknown) => void }) {
  useRealtimeSubscription(["message:new", "call:invite"], onEvent);
  return null;
}

function createSocket() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const socket = {
    active: false,
    auth: {},
    connected: false,
    on: vi.fn((name: string, listener: (...args: unknown[]) => void) => {
      const listeners = handlers.get(name) ?? new Set();
      listeners.add(listener);
      handlers.set(name, listeners);
      return socket;
    }),
    off: vi.fn((name: string, listener: (...args: unknown[]) => void) => {
      handlers.get(name)?.delete(listener);
      return socket;
    }),
    connect: vi.fn(() => {
      socket.connected = true;
      handlers.get("connect")?.forEach(listener => listener());
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      return socket;
    }),
    timeout: vi.fn(() => ({
      emit: vi.fn((_name: string, _payload: unknown, acknowledgement: (error: Error | null, response?: unknown) => void) => acknowledgement(null, { success: true, recipientCount: 1 })),
    })),
  };
  return socket as unknown as Socket;
}

describe("اشتراكات الأحداث اللحظية", () => {
  afterEach(() => {
    cleanup();
    clearRestAccessToken();
    realtimeTestApi.reset();
  });

  it("تتصل وتعيد الاشتراك عندما تُستعاد جلسة REST بعد تحميل الواجهة", async () => {
    clearRestAccessToken();
    const socket = createSocket();
    realtimeTestApi.setSocketFactory(() => socket);

    render(<SubscriptionProbe onEvent={vi.fn()} />);
    expect(socket.connect).not.toHaveBeenCalled();

    setRestAccessToken("session-token");

    await waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(1));
    expect(socket.auth).toEqual({ token: "session-token" });
    expect(socket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith("call:invite", expect.any(Function));
  });

  it("ينتظر إقرار البوابة قبل اعتبار دعوة المكالمة مرسلة", async () => {
    const socket = createSocket();
    realtimeTestApi.setSocketFactory(() => socket);
    setRestAccessToken("session-token");
    connectRealtime();

    const receipt = await emitCallSignal("call:invite", { conversationId: "conversation-1", callId: "call-1", mode: "audio", description: { type: "offer", sdp: "offer-sdp" } });

    expect(receipt).toEqual({ success: true, recipientCount: 1 });
    expect(socket.timeout).toHaveBeenCalledWith(7_000);
  });
});
