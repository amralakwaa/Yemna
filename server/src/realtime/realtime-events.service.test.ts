import { describe, expect, it, vi } from "vitest";
import { RealtimeEventsService } from "./realtime-events.service";

describe("RealtimeEventsService", () => {
  it("يبث الحدث محلياً حتى عند عدم إعداد Redis", async () => {
    const service = new RealtimeEventsService({ get: vi.fn(() => "") } as never);
    const listener = vi.fn();
    service.subscribe(listener);

    const event = await service.emit("user-1", "message:new", { conversationId: "conversation-1" });

    expect(event.recipientId).toBe("user-1");
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ name: "message:new", payload: { conversationId: "conversation-1" } }));
    await service.onModuleDestroy();
  });
});
