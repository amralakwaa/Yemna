import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime/realtime-events.service";

const actor = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;

const preferenceByType = {
  MESSAGE: "notifyMessages",
  FRIEND_REQUEST: "notifyFriendRequests",
  FRIEND_ACCEPTED: "notifyFriendRequests",
  FOLLOW: "notifyFollows",
  POST_REACTION: "notifyPostActivity",
  POST_COMMENT: "notifyPostActivity",
  COMMENT_REPLY: "notifyPostActivity",
  CALL_INVITE: "notifyCalls",
  COMMUNITY: "notifyCommunities",
} as const;

type NotificationPreference = (typeof preferenceByType)[keyof typeof preferenceByType];

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeEventsService) private readonly realtime: RealtimeEventsService,
  ) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }
  async list(userId: string, type?: NotificationType) {
    return this.database().notification.findMany({
      where: { recipientId: userId, ...(type ? { type } : {}) },
      include: { actor: { select: actor } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async unreadCount(userId: string) {
    const count = await this.database().notification.count({ where: { recipientId: userId, readAt: null } });
    return { count };
  }
  private async preferenceAllows(recipientId: string, type: NotificationType) {
    const preference = preferenceByType[type as keyof typeof preferenceByType] as NotificationPreference | undefined;
    if (!preference) return true;
    // Keep notification delivery available in isolated test doubles and staged
    // installations that have not exposed UserSettings yet.
    const userSettings = this.database().userSettings;
    if (!userSettings?.findUnique) return true;
    try {
      const settings = await userSettings.findUnique({
        where: { userId: recipientId },
        select: {
          notifyMessages: true,
          notifyFriendRequests: true,
          notifyFollows: true,
          notifyPostActivity: true,
          notifyCalls: true,
          notifyCommunities: true,
        },
      });
      return settings?.[preference] !== false;
    } catch (error) {
      // A staged deploy against an older schema preserves historical delivery.
      const message = error instanceof Error ? error.message : String(error);
      const isMissingPreferenceColumn = message.includes("UserSettings") && message.includes("notify") && message.includes("column");
      if (isMissingPreferenceColumn) return true;
      throw error;
    }
  }
  async create(input: { recipientId: string; actorId?: string; type: NotificationType; title: string; body?: string; linkUrl?: string; sourceKey?: string }) {
    if (!(await this.preferenceAllows(input.recipientId, input.type))) return null;
    const { sourceKey, ...data } = input;
    const notification = sourceKey
      ? await this.database().notification.upsert({
          where: { recipientId_sourceKey: { recipientId: input.recipientId, sourceKey } },
          create: { ...data, sourceKey },
          update: { ...data, readAt: null },
          include: { actor: { select: actor } },
        })
      : await this.database().notification.create({ data, include: { actor: { select: actor } } });
    await this.realtime.emit(input.recipientId, "notification:new", notification);
    return notification;
  }
  async removeBySourceKey(recipientId: string, sourceKey: string) {
    const result = await this.database().notification.deleteMany({ where: { recipientId, sourceKey } });
    if (result.count) await this.realtime.emit(recipientId, "notification:read", { sourceKey, removed: true });
    return { success: true };
  }
  async markRead(userId: string, notificationId: string) {
    const result = await this.database().notification.updateMany({ where: { id: notificationId, recipientId: userId }, data: { readAt: new Date() } });
    if (!result.count) throw new NotFoundException("الإشعار غير موجود");
    await this.realtime.emit(userId, "notification:read", { notificationId });
    return { success: true };
  }
  async markAllRead(userId: string) {
    await this.database().notification.updateMany({ where: { recipientId: userId, readAt: null }, data: { readAt: new Date() } });
    await this.realtime.emit(userId, "notification:read", { all: true });
    return { success: true };
  }
}
