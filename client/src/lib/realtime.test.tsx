import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import { clearRestAccessToken, setRestAccessToken } from "./api";
import { realtimeTestApi, useRealtimeSubscription } from "./realtime";

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
});
