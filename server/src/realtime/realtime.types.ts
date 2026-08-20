export type RealtimeEventName = "message:new" | "notification:new" | "notification:read";

export interface RealtimeEvent<TPayload = unknown> {
  id: string;
  origin: string;
  recipientId: string;
  name: RealtimeEventName;
  payload: TPayload;
  occurredAt: string;
}
