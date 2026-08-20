import Redis from "ioredis";
import { afterEach, describe, expect, it } from "vitest";

describe("Realtime Redis connection", () => {
  let client: Redis | undefined;

  afterEach(async () => {
    if (client && client.status !== "end") await client.quit().catch(() => client?.disconnect());
    client = undefined;
  });

  it("accepts the configured endpoint and responds to PING", async () => {
    const url = process.env.YEMNA_REDIS_URL;
    expect(url).toBeTruthy();

    client = new Redis(url!, {
      connectTimeout: 4_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    client.on("error", () => undefined);

    await client.connect();
    await expect(client.ping()).resolves.toBe("PONG");
  }, 7_000);
});
