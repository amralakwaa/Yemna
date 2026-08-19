import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { YemnaEnv } from "../config/env";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService<YemnaEnv, true>) {
    const databaseUrl = config.get("YEMNA_DATABASE_URL", { infer: true });
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {});
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
