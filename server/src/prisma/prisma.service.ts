import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { YemnaEnv } from "../config/env";

const DEFAULT_CONNECTION_LIMIT = "3";
const DEFAULT_POOL_TIMEOUT_SECONDS = "30";

/**
 * Keeps each Nest process within the small connection budget of hosted PostgreSQL.
 * Existing explicit pool settings always take precedence over these safe defaults.
 */
export function withPrismaPoolSettings(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", DEFAULT_CONNECTION_LIMIT);
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", DEFAULT_POOL_TIMEOUT_SECONDS);
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private databaseConnected = false;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<YemnaEnv, true>) {
    const databaseUrl = config.get("YEMNA_DATABASE_URL", { infer: true });
    super(databaseUrl ? { datasources: { db: { url: withPrismaPoolSettings(databaseUrl) } } } : {});
  }

  hasDatabaseConfiguration(): boolean {
    return Boolean(this.config.get("YEMNA_DATABASE_URL", { infer: true }));
  }

  isConnected(): boolean {
    return this.databaseConnected;
  }

  /**
   * Existing database-backed services use this guard before issuing queries.
   * A configured-but-unreachable database is deliberately treated as unavailable
   * so those endpoints can return their established 503 response instead of
   * surfacing an unhandled Prisma connection error.
   */
  isConfigured(): boolean {
    return this.hasDatabaseConfiguration() && this.isConnected();
  }

  async onModuleInit(): Promise<void> {
    if (!this.hasDatabaseConfiguration()) {
      this.logger.warn("PostgreSQL is not configured; database-backed endpoints will return 503.");
      return;
    }

    try {
      await this.$connect();
      this.databaseConnected = true;
    } catch (error) {
      this.databaseConnected = false;
      const detail = error instanceof Error ? error.message : "unknown connection error";
      this.logger.error(`PostgreSQL connection is unavailable; database-backed endpoints will return 503. ${detail}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected()) await this.$disconnect();
    this.databaseConnected = false;
  }
}
