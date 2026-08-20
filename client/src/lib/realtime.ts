import { useEffect, useState } from "react";
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
let connectionStatus: RealtimeConnectionStatus = "offline";
let socketFactory: () => Socket = () => io("/realtime", {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5_000,
});
const statusListeners = new Set<(status: RealtimeConnectionStatus) => void>();

export type RealtimeConnectionStatus = "offline" | "connecting" | "connected" | "reconnecting" | "error";

function setConnectionStatus(status: RealtimeConnectionStatus) {
  if (connectionStatus === status) return;
  connectionStatus = status;
  statusListeners.forEach(listener => listener(status));
}

function attachConnectionListeners(target: Socket) {
  target.on("connect", () => setConnectionStatus("connected"));
  target.on("disconnect", reason => setConnectionStatus(reason === "io client disconnect" ? "offline" : "reconnecting"));
  target.on("reconnect_attempt", () => setConnectionStatus("reconnecting"));
  target.on("reconnect_failed", () => setConnectionStatus("offline"));
  target.on("connect_error", () => setConnectionStatus("error"));
  target.on("realtime:error", () => setConnectionStatus("error"));
}

export function subscribeRealtimeStatus(listener: (status: RealtimeConnectionStatus) => void) {
  statusListeners.add(listener);
  listener(connectionStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function connectRealtime(accessToken = getRestAccessToken()) {
  if (!accessToken) {
    setConnectionStatus("offline");
    return undefined;
  }
  if (!socket) {
    socket = socketFactory();
    attachConnectionListeners(socket);
  }
  socket.auth = { token: accessToken };
  if (!socket.connected) {
    setConnectionStatus(socket.active ? "reconnecting" : "connecting");
    socket.connect();
  }
  return socket;
}

function activeSocket() {
  return connectRealtime();
}

export function useRealtimeConnectionStatus() {
  const [status, setStatus] = useState<RealtimeConnectionStatus>(connectionStatus);
  useEffect(() => subscribeRealtimeStatus(setStatus), []);
  useEffect(() => {
    if (!getRestAccessToken()) {
      setConnectionStatus("offline");
      return;
    }
    connectRealtime();
  }, []);
  return status;
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

export const realtimeTestApi = {
  reset() {
    socket?.disconnect();
    socket = undefined;
    listeners = 0;
    connectionStatus = "offline";
    statusListeners.clear();
    socketFactory = () => io("/realtime", { autoConnect: false, transports: ["websocket", "polling"], withCredentials: true, reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 800, reconnectionDelayMax: 5_000 });
  },
  setSocketFactory(factory: () => Socket) { socketFactory = factory; },
};
