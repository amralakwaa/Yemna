import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { RealtimeEvent, RealtimeEventName } from "./realtime.types";

const CHANNEL = "yemna:realtime:v1";

@Injectable()
export class RealtimeEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private readonly emitter = new EventEmitter();
  private readonly origin = randomUUID();
  private publisher?: Redis;
  private subscriber?: Redis;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("YEMNA_REDIS_URL");
    if (!url) return;

    try {
      this.publisher = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
      this.subscriber = this.publisher.duplicate({ lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
      this.publisher.on("error", error => this.logger.warn(`تعذر نشر حدث Redis: ${error.message}`));
      this.subscriber.on("error", error => this.logger.warn(`تعذر استقبال حدث Redis: ${error.message}`));
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(CHANNEL);
      this.subscriber.on("message", (_channel, raw) => this.receive(raw));
      this.logger.log("تم تفعيل توزيع الأحداث اللحظية عبر Redis");
    } catch (error) {
      this.logger.warn(`سيستمر البث داخل النسخة الحالية فقط؛ Redis غير متاح: ${error instanceof Error ? error.message : "خطأ غير معروف"}`);
      await this.closeRedis();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeRedis();
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  async emit<TPayload>(recipientId: string, name: RealtimeEventName, payload: TPayload): Promise<RealtimeEvent<TPayload>> {
    const event: RealtimeEvent<TPayload> = { id: randomUUID(), origin: this.origin, recipientId, name, payload, occurredAt: new Date().toISOString() };
    this.deliver(event);
    if (this.publisher) await this.publisher.publish(CHANNEL, JSON.stringify(event)).catch(() => undefined);
    return event;
  }

  private receive(raw: string): void {
    try {
      const event = JSON.parse(raw) as RealtimeEvent;
      if (event.origin !== this.origin && event.recipientId && event.name) this.deliver(event);
    } catch {
      this.logger.warn("تم تجاهل حدث لحظي غير صالح من Redis");
    }
  }

  private deliver(event: RealtimeEvent): void {
    this.emitter.emit("event", event);
  }

  private async closeRedis(): Promise<void> {
    const clients = [this.publisher, this.subscriber].filter((client): client is Redis => Boolean(client));
    this.publisher = undefined;
    this.subscriber = undefined;
    await Promise.all(clients.map(client => client.quit().catch(() => client.disconnect())));
  }
}
