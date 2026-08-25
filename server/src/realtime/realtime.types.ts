export type RealtimeEventName = "message:new" | "message:read" | "typing:start" | "typing:stop" | "notification:new" | "notification:read" | "call:invite" | "call:answer" | "call:candidate" | "call:decline" | "call:end" | "call:busy";

export interface RealtimeEvent<TPayload = unknown> {
  id: string;
  origin: string;
  recipientId: string;
  name: RealtimeEventName;
  payload: TPayload;
  occurredAt: string;
}
