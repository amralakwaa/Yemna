import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CommunityMemberRole, CommunityVisibility, ConversationKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommunityDto, UpdateCommunityDto, UpdateCommunityMemberRoleDto } from "./dto/community.dto";

const owner = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;
const communityInclude = { owner: { select: owner }, _count: { select: { members: true, posts: true } } } satisfies Prisma.CommunityInclude;
const memberInclude = { user: { select: { id: true, displayName: true, username: true, avatarUrl: true, bio: true } } } satisfies Prisma.CommunityMemberInclude;

type CommunityRecord = { id: string; name: string; ownerId: string; conversationId: string | null };
type CommunityActor = { ownerId: string; role: CommunityMemberRole | null };

@Injectable()
export class CommunitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    return this.prisma;
  }

  private async ensureConversation(tx: Prisma.TransactionClient, community: CommunityRecord) {
    if (community.conversationId) return community.conversationId;
    const memberships = await tx.communityMember.findMany({ where: { communityId: community.id }, select: { userId: true } });
    const participantIds = Array.from(new Set([community.ownerId, ...memberships.map(({ userId }) => userId)]));
    const conversation = await tx.conversation.create({
      data: { kind: ConversationKind.GROUP, title: community.name, createdById: community.ownerId, participants: { create: participantIds.map((userId) => ({ userId })) } },
      select: { id: true },
    });
    await tx.community.update({ where: { id: community.id }, data: { conversationId: conversation.id } });
    return conversation.id;
  }

  private async actorFor(tx: Prisma.TransactionClient, actorId: string, communityId: string): Promise<CommunityActor> {
    const community = await tx.community.findUnique({ where: { id: communityId }, select: { ownerId: true } });
    if (!community) throw new NotFoundException("المجتمع غير موجود");
    const membership = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: actorId } }, select: { role: true } });
    return { ownerId: community.ownerId, role: membership?.role ?? null };
  }

  async list() {
    return this.database().community.findMany({ include: communityInclude, orderBy: { createdAt: "desc" } });
  }

  async listForUser(userId: string) {
    const memberships = await this.database().communityMember.findMany({
      where: { userId },
      include: { community: { include: communityInclude } },
      orderBy: { joinedAt: "desc" },
    });
    return memberships.map(({ community }) => community);
  }

  async get(communityId: string) {
    const community = await this.database().community.findUnique({ where: { id: communityId }, include: communityInclude });
    if (!community) throw new NotFoundException("المجتمع غير موجود");
    return community;
  }

  async create(ownerId: string, dto: CreateCommunityDto) {
    const existing = await this.database().community.findUnique({ where: { slug: dto.slug }, select: { id: true } });
    if (existing) throw new ConflictException("معرّف المجتمع مستخدم بالفعل");
    return this.database().$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: { kind: ConversationKind.GROUP, title: dto.name, createdById: ownerId, participants: { create: { userId: ownerId } } },
        select: { id: true },
      });
      return tx.community.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          coverUrl: dto.coverUrl,
          visibility: dto.visibility ? CommunityVisibility[dto.visibility] : CommunityVisibility.PUBLIC,
          ownerId,
          conversationId: conversation.id,
          members: { create: { userId: ownerId, role: CommunityMemberRole.ADMIN } },
        },
        include: communityInclude,
      });
    });
  }

  async join(userId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, name: true, ownerId: true, visibility: true, conversationId: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      if (community.visibility === CommunityVisibility.PRIVATE) throw new ForbiddenException("يتطلب هذا المجتمع موافقة الإدارة");
      const conversationId = await this.ensureConversation(tx, community);
      const membership = await tx.communityMember.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId },
        update: {},
        include: memberInclude,
      });
      await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId } }, create: { conversationId, userId }, update: {} });
      return membership;
    });
  }

  async leave(userId: string, communityId: string) {
    await this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, name: true, ownerId: true, conversationId: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      if (community.ownerId === userId) throw new BadRequestException("لا يمكن لمالك المجتمع مغادرته قبل نقل الملكية أو حذفه");
      const conversationId = await this.ensureConversation(tx, community);
      await tx.communityMember.deleteMany({ where: { communityId, userId } });
      await tx.conversationParticipant.deleteMany({ where: { conversationId, userId } });
    });
    return { success: true };
  }

  async update(actorId: string, communityId: string, dto: UpdateCommunityDto) {
    return this.database().$transaction(async (tx) => {
      const actor = await this.actorFor(tx, actorId, communityId);
      if (actor.ownerId !== actorId) throw new ForbiddenException("إعدادات المجتمع متاحة للمالك فقط");
      const updated = await tx.community.update({
        where: { id: communityId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
          ...(dto.visibility !== undefined ? { visibility: CommunityVisibility[dto.visibility] } : {}),
        },
        include: communityInclude,
      });
      if (dto.name !== undefined && updated.conversationId) await tx.conversation.update({ where: { id: updated.conversationId }, data: { title: dto.name } });
      return updated;
    });
  }

  async setMemberRole(actorId: string, communityId: string, memberId: string, dto: UpdateCommunityMemberRoleDto) {
    return this.database().$transaction(async (tx) => {
      const actor = await this.actorFor(tx, actorId, communityId);
      if (actor.ownerId !== actorId) throw new ForbiddenException("تغيير أدوار الأعضاء متاح لمالك المجتمع فقط");
      const target = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: memberId } }, include: memberInclude });
      if (!target) throw new NotFoundException("العضو غير موجود في هذا المجتمع");
      if (memberId === actor.ownerId) throw new BadRequestException("لا يمكن تغيير دور مالك المجتمع");
      return tx.communityMember.update({ where: { id: target.id }, data: { role: CommunityMemberRole[dto.role] }, include: memberInclude });
    });
  }

  async removeMember(actorId: string, communityId: string, memberId: string) {
    await this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, name: true, ownerId: true, conversationId: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      const actorMembership = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: actorId } }, select: { role: true } });
      const target = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: memberId } }, select: { role: true } });
      if (!target) throw new NotFoundException("العضو غير موجود في هذا المجتمع");
      if (memberId === community.ownerId) throw new BadRequestException("لا يمكن إزالة مالك المجتمع");
      const isOwner = actorId === community.ownerId;
      const isManager = actorMembership?.role === CommunityMemberRole.ADMIN || actorMembership?.role === CommunityMemberRole.MODERATOR;
      if (!isOwner && !isManager) throw new ForbiddenException("لا تملك صلاحية إزالة هذا العضو");
      if (!isOwner && target.role !== CommunityMemberRole.MEMBER) throw new ForbiddenException("لا يمكنك إزالة أعضاء الإدارة");
      const conversationId = await this.ensureConversation(tx, community);
      await tx.communityMember.delete({ where: { communityId_userId: { communityId, userId: memberId } } });
      await tx.conversationParticipant.deleteMany({ where: { conversationId, userId: memberId } });
    });
    return { success: true };
  }

  async getConversation(userId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, name: true, ownerId: true, conversationId: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      const membership = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } }, select: { id: true } });
      if (!membership) throw new ForbiddenException("انضم إلى المجتمع أولاً للوصول إلى رسائله");
      const conversationId = await this.ensureConversation(tx, community);
      await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId } }, create: { conversationId, userId }, update: {} });
      return tx.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { participants: { include: { user: { select: owner } } } } });
    });
  }

  async members(communityId: string) {
    await this.get(communityId);
    return this.database().communityMember.findMany({ where: { communityId }, include: memberInclude, orderBy: [{ role: "desc" }, { joinedAt: "asc" }] });
  }
}
