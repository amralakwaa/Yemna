import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AccountStatus, ConversationKind, Prisma } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime/realtime-events.service";
import { CreateConversationDto, SendMessageDto } from "./dto/message.dto";

const user = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;

type MessageSendContext = {
  notification?: {
    title: string;
    linkUrl?: string;
  };
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeEventsService) private readonly realtime: RealtimeEventsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }

  async conversations(userId: string) {
    const memberships = await this.database().conversationParticipant.findMany({
      where: { userId },
      include: { conversation: { include: { participants: { include: { user: { select: user } } }, messages: { take: 1, orderBy: { createdAt: "desc" }, include: { sender: { select: user }, media: true } } } } },
      orderBy: { conversation: { updatedAt: "desc" } },
    });
    return Promise.all(memberships.map(async membership => ({
      ...membership.conversation,
      lastReadAt: membership.lastReadAt,
      unreadCount: await this.database().message.count({
        where: {
          conversationId: membership.conversationId,
          senderId: { not: userId },
          ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
        },
      }),
    })));
  }

  async create(userId: string, dto: CreateConversationDto) {
    const participantIds = Array.from(new Set([userId, ...dto.participantIds]));
    if (participantIds.length < 2) throw new BadRequestException("يجب اختيار مستخدم آخر واحد على الأقل");
    const users = await this.database().user.findMany({ where: { id: { in: participantIds }, status: AccountStatus.ACTIVE }, select: { id: true } });
    if (users.length !== participantIds.length) throw new NotFoundException("واحد أو أكثر من المشاركين غير متاحين");
    const kind = participantIds.length === 2 && !dto.title ? ConversationKind.DIRECT : ConversationKind.GROUP;
    return this.database().conversation.create({ data: { kind, title: dto.title, createdById: userId, participants: { create: participantIds.map(id => ({ userId: id })) } }, include: { participants: { include: { user: { select: user } } } } });
  }

  async findOrCreateDirectConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException("لا يمكن إنشاء محادثة مباشرة مع الحساب نفسه");
    const existing = await this.database().conversationParticipant.findFirst({
      where: { userId, conversation: { kind: ConversationKind.DIRECT, participants: { some: { userId: otherUserId } } } },
      include: { conversation: { include: { participants: { include: { user: { select: user } } } } } },
      orderBy: { conversation: { updatedAt: "desc" } },
    });
    if (existing) return existing.conversation;
    return this.create(userId, { participantIds: [otherUserId] });
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const participation = await this.database().conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { id: true } });
    if (!participation) throw new ForbiddenException("لا تملك صلاحية الوصول إلى هذه المحادثة");
  }

  async messages(userId: string, conversationId: string, cursor?: string, limit = 30) {
    await this.assertParticipant(userId, conversationId);
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.database().message.findMany({
      where: { conversationId },
      include: { sender: { select: user }, media: true },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = rows.length > take;
    const items = rows.slice(0, take).reverse();
    return { items, nextCursor: hasMore ? items[0]?.id ?? null : null };
  }

  async send(userId: string, conversationId: string, dto: SendMessageDto, context?: MessageSendContext) {
    await this.assertParticipant(userId, conversationId);
    const body = dto.body?.trim() ?? "";
    if (!body && !dto.mediaId) throw new BadRequestException("أدخل رسالة أو اختر صورة");
    if (dto.mediaId) {
      const media = await this.database().mediaAsset.findFirst({ where: { id: dto.mediaId, ownerId: userId, messageId: null, kind: "IMAGE" }, select: { id: true } });
      if (!media) throw new ForbiddenException("الصورة غير متاحة أو لا تملك صلاحية استخدامها");
    }
    const [message] = await this.database().$transaction([
      this.database().message.create({ data: { conversationId, senderId: userId, body, ...(dto.mediaId ? { media: { connect: { id: dto.mediaId } } } : {}) }, include: { sender: { select: user }, media: true } }),
      this.database().conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
      this.database().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } }),
    ]);
    const recipients = await this.database().conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
    const deliveryResults = await Promise.allSettled(recipients.map(async ({ userId: recipientId }) => {
      await this.realtime.emit(recipientId, "message:new", { conversationId, message });
      await this.notifications.create({
        recipientId,
        actorId: userId,
        type: "MESSAGE",
        title: context?.notification?.title ?? `رسالة جديدة من ${message.sender.displayName}`,
        body: message.body,
        linkUrl: context?.notification?.linkUrl ?? `/messages?conversation=${encodeURIComponent(conversationId)}`,
        sourceKey: `message:${message.id}`,
      });
    }));
    if (deliveryResults.some(result => result.status === "rejected")) {
      this.logger.warn(`تعذر إيصال بعض أحداث الرسائل للمحادثة ${conversationId}`);
    }
    return message;
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const lastReadAt = new Date();
    await this.database().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt } });
    const recipients = await this.database().conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
    await Promise.all(recipients.map(recipient => this.realtime.emit(recipient.userId, "message:read", { conversationId, userId, lastReadAt: lastReadAt.toISOString() })));
    return { success: true, lastReadAt: lastReadAt.toISOString() };
  }
}
