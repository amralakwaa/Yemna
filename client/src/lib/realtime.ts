import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getRestAccessToken } from "./api";

export type RealtimeEvent<T = unknown> = {
  id: string;
  recipientId: string;
  name: "message:new" | "notification:new" | "notification:read";
  payload: T;
  occurredAt: string;
};

let socket: Socket | undefined;
let listeners = 0;

function activeSocket() {
  const token = getRestAccessToken();
  if (!token) return undefined;
  if (!socket) socket = io("/realtime", { autoConnect: false, transports: ["websocket", "polling"], withCredentials: true });
  socket.auth = { token };
  if (!socket.connected) socket.connect();
  return socket;
}

export function useRealtimeSubscription(names: RealtimeEvent["name"][], onEvent: (event: RealtimeEvent) => void) {
  useEffect(() => {
    const connected = activeSocket();
    if (!connected) return;
    listeners += 1;
    const handlers = names.map(name => {
      const handler = (event: RealtimeEvent) => onEvent(event);
      connected.on(name, handler);
      return [name, handler] as const;
    });
    return () => {
      handlers.forEach(([name, handler]) => connected.off(name, handler));
      listeners -= 1;
      if (listeners === 0) connected.disconnect();
    };
  }, [names.join("|"), onEvent]);
}
