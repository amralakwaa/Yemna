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

  constructor(@Inject(ConfigService) private readonly config: ConfigService<YemnaEnv, true>) {
    const databaseUrl = config.get("YEMNA_DATABASE_URL", { infer: true });
    super(databaseUrl ? { datasources: { db: { url: withPrismaPoolSettings(databaseUrl) } } } : {});
  }

  isConfigured(): boolean {
    return Boolean(this.config.get("YEMNA_DATABASE_URL", { infer: true }));
  }

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn("PostgreSQL is not configured; database-backed endpoints will return 503.");
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConfigured()) await this.$disconnect();
  }
}
