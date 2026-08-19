import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AccountStatus, ConversationKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateConversationDto, SendMessageDto } from "./dto/message.dto";

const user = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;

@Injectable()
export class MessagesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }

  async conversations(userId: string) {
    const memberships = await this.database().conversationParticipant.findMany({
      where: { userId },
      include: { conversation: { include: { participants: { include: { user: { select: user } } }, messages: { take: 1, orderBy: { createdAt: "desc" }, include: { sender: { select: user } } } } } },
      orderBy: { conversation: { updatedAt: "desc" } },
    });
    return memberships.map(membership => ({ ...membership.conversation, lastReadAt: membership.lastReadAt }));
  }

  async create(userId: string, dto: CreateConversationDto) {
    const participantIds = Array.from(new Set([userId, ...dto.participantIds]));
    if (participantIds.length < 2) throw new BadRequestException("يجب اختيار مستخدم آخر واحد على الأقل");
    const users = await this.database().user.findMany({ where: { id: { in: participantIds }, status: AccountStatus.ACTIVE }, select: { id: true } });
    if (users.length !== participantIds.length) throw new NotFoundException("واحد أو أكثر من المشاركين غير متاحين");
    const kind = participantIds.length === 2 && !dto.title ? ConversationKind.DIRECT : ConversationKind.GROUP;
    return this.database().conversation.create({ data: { kind, title: dto.title, createdById: userId, participants: { create: participantIds.map(id => ({ userId: id })) } }, include: { participants: { include: { user: { select: user } } } } });
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const participation = await this.database().conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { id: true } });
    if (!participation) throw new ForbiddenException("لا تملك صلاحية الوصول إلى هذه المحادثة");
  }

  async messages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.database().message.findMany({ where: { conversationId }, include: { sender: { select: user } }, orderBy: { createdAt: "asc" } });
  }

  async send(userId: string, conversationId: string, dto: SendMessageDto) {
    await this.assertParticipant(userId, conversationId);
    const [message] = await this.database().$transaction([
      this.database().message.create({ data: { conversationId, senderId: userId, body: dto.body }, include: { sender: { select: user } } }),
      this.database().conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
      this.database().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } }),
    ]);
    return message;
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    await this.database().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
    return { success: true };
  }
}
