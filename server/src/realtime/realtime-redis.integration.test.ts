import { afterEach, describe, expect, it } from "vitest";
import { RealtimeEventsService } from "./realtime-events.service";

const waitFor = async (predicate: () => boolean, timeoutMs = 5_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("لم يصل الحدث المشترك عبر Redis ضمن المهلة المحددة");
};

describe("توزيع الأحداث اللحظية عبر Redis", () => {
  const services: RealtimeEventsService[] = [];

  afterEach(async () => {
    await Promise.all(services.splice(0).map(service => service.onModuleDestroy()));
  });

  it("يوصل حدثاً من نسخة ناشرة إلى نسخة مشتركة مستقلة", async () => {
    const url = process.env.YEMNA_REDIS_URL;
    expect(url).toBeTruthy();

    const config = { get: (key: string) => (key === "YEMNA_REDIS_URL" ? url : undefined) } as never;
    const publisherInstance = new RealtimeEventsService(config);
    const subscriberInstance = new RealtimeEventsService(config);
    services.push(publisherInstance, subscriberInstance);

    await Promise.all([publisherInstance.onModuleInit(), subscriberInstance.onModuleInit()]);

    const received: Array<{ recipientId: string; name: string; payload: { conversationId: string } }> = [];
    subscriberInstance.subscribe(event => received.push(event as (typeof received)[number]));

    await publisherInstance.emit("redis-integration-user", "message:new", { conversationId: "redis-integration-conversation" });

    await waitFor(() => received.some(event => event.recipientId === "redis-integration-user" && event.name === "message:new"));
    expect(received).toContainEqual(expect.objectContaining({
      recipientId: "redis-integration-user",
      name: "message:new",
      payload: { conversationId: "redis-integration-conversation" },
    }));
  }, 10_000);
});
