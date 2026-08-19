import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const actor = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }
  async list(userId: string) { return this.database().notification.findMany({ where: { recipientId: userId }, include: { actor: { select: actor } }, orderBy: { createdAt: "desc" }, take: 100 }); }
  async markRead(userId: string, notificationId: string) {
    const result = await this.database().notification.updateMany({ where: { id: notificationId, recipientId: userId }, data: { readAt: new Date() } });
    if (!result.count) throw new NotFoundException("الإشعار غير موجود");
    return { success: true };
  }
  async markAllRead(userId: string) { await this.database().notification.updateMany({ where: { recipientId: userId, readAt: null }, data: { readAt: new Date() } }); return { success: true }; }
}
