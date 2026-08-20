import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const RETENTION_DAYS = 90;
const INTERVAL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class NotificationMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationMaintenanceService.name);
  private timer?: NodeJS.Timeout;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.pruneReadNotifications(), INTERVAL_MS);
    this.timer.unref();
    void this.pruneReadNotifications();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async pruneReadNotifications(now = new Date()): Promise<number> {
    if (!this.prisma.isConfigured()) return 0;
    const olderThan = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.notification.deleteMany({ where: { readAt: { not: null, lt: olderThan } } });
    if (result.count) this.logger.log(`تم تنظيف ${result.count} إشعاراً مقروءاً منتهياً`);
    return result.count;
  }
}
