import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CommunityAuditAction, CommunityJoinRequestStatus, CommunityMemberRole, CommunityVisibility, ConversationKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommunityDto, RespondToCommunityJoinRequestDto, TransferCommunityOwnershipDto, UpdateCommunityDto, UpdateCommunityMemberRoleDto } from "./dto/community.dto";

const person = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;
const communityInclude = { owner: { select: person }, _count: { select: { members: true, posts: true } } } satisfies Prisma.CommunityInclude;
const memberInclude = { user: { select: { id: true, displayName: true, username: true, avatarUrl: true, bio: true } } } satisfies Prisma.CommunityMemberInclude;
const joinRequestInclude = { requester: { select: person }, reviewer: { select: person } } satisfies Prisma.CommunityJoinRequestInclude;
const auditInclude = { actor: { select: person }, targetUser: { select: person } } satisfies Prisma.CommunityAuditLogInclude;

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

  private async assertReviewer(tx: Prisma.TransactionClient, actorId: string, communityId: string) {
    const actor = await this.actorFor(tx, actorId, communityId);
    const isReviewer = actor.ownerId === actorId || actor.role === CommunityMemberRole.ADMIN || actor.role === CommunityMemberRole.MODERATOR;
    if (!isReviewer) throw new ForbiddenException("مراجعة طلبات المجتمع متاحة للمالك والإدارة فقط");
    return actor;
  }

  private audit(tx: Prisma.TransactionClient, communityId: string, actorId: string, action: CommunityAuditAction, options: { targetUserId?: string; metadata?: Prisma.InputJsonValue } = {}) {
    return tx.communityAuditLog.create({ data: { communityId, actorId, action, ...(options.targetUserId ? { targetUserId: options.targetUserId } : {}), ...(options.metadata ? { metadata: options.metadata } : {}) } });
  }

  async list() {
    return this.database().community.findMany({ include: communityInclude, orderBy: { createdAt: "desc" } });
  }

  async listForUser(userId: string) {
    const memberships = await this.database().communityMember.findMany({
      where: { userId }, include: { community: { include: communityInclude } }, orderBy: { joinedAt: "desc" },
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
        data: { kind: ConversationKind.GROUP, title: dto.name, createdById: ownerId, participants: { create: { userId: ownerId } } }, select: { id: true },
      });
      const community = await tx.community.create({
        data: { name: dto.name, slug: dto.slug, description: dto.description, coverUrl: dto.coverUrl, visibility: dto.visibility ? CommunityVisibility[dto.visibility] : CommunityVisibility.PUBLIC, ownerId, conversationId: conversation.id, members: { create: { userId: ownerId, role: CommunityMemberRole.ADMIN } } },
        include: communityInclude,
      });
      await this.audit(tx, community.id, ownerId, CommunityAuditAction.COMMUNITY_CREATED);
      return community;
    });
  }

  async join(userId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, name: true, ownerId: true, visibility: true, conversationId: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      if (community.visibility === CommunityVisibility.PRIVATE) throw new ForbiddenException("هذا مجتمع خاص؛ أرسل طلب انضمام لمراجعته من الإدارة");
      const conversationId = await this.ensureConversation(tx, community);
      const membership = await tx.communityMember.upsert({ where: { communityId_userId: { communityId, userId } }, create: { communityId, userId }, update: {}, include: memberInclude });
      await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId } }, create: { conversationId, userId }, update: {} });
      await this.audit(tx, communityId, userId, CommunityAuditAction.MEMBER_JOINED);
      return membership;
    });
  }

  async requestJoin(userId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, visibility: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      if (community.visibility !== CommunityVisibility.PRIVATE) throw new BadRequestException("يمكن الانضمام إلى المجتمع العام مباشرة");
      const membership = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } }, select: { id: true } });
      if (membership) throw new ConflictException("أنت عضو في هذا المجتمع بالفعل");
      const existing = await tx.communityJoinRequest.findUnique({ where: { communityId_userId: { communityId, userId } } });
      if (existing?.status === CommunityJoinRequestStatus.PENDING) throw new ConflictException("يوجد طلب انضمام قيد المراجعة بالفعل");
      const request = existing
        ? await tx.communityJoinRequest.update({ where: { id: existing.id }, data: { status: CommunityJoinRequestStatus.PENDING, reviewerId: null, respondedAt: null }, include: joinRequestInclude })
        : await tx.communityJoinRequest.create({ data: { communityId, userId }, include: joinRequestInclude });
      await this.audit(tx, communityId, userId, CommunityAuditAction.JOIN_REQUEST_CREATED);
      return request;
    });
  }

  async getMyJoinRequest(userId: string, communityId: string) {
    await this.get(communityId);
    return this.database().communityJoinRequest.findUnique({ where: { communityId_userId: { communityId, userId } }, include: joinRequestInclude });
  }

  async cancelJoinRequest(userId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      const request = await tx.communityJoinRequest.findUnique({ where: { communityId_userId: { communityId, userId } } });
      if (!request || request.status !== CommunityJoinRequestStatus.PENDING) throw new NotFoundException("طلب الانضمام غير متاح للإلغاء");
      const updated = await tx.communityJoinRequest.update({ where: { id: request.id }, data: { status: CommunityJoinRequestStatus.CANCELLED, respondedAt: new Date() }, include: joinRequestInclude });
      await this.audit(tx, communityId, userId, CommunityAuditAction.JOIN_REQUEST_CANCELLED);
      return updated;
    });
  }

  async listJoinRequests(actorId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      await this.assertReviewer(tx, actorId, communityId);
      return tx.communityJoinRequest.findMany({ where: { communityId, status: CommunityJoinRequestStatus.PENDING }, include: joinRequestInclude, orderBy: { createdAt: "asc" } });
    });
  }

  async respondToJoinRequest(actorId: string, communityId: string, requestId: string, dto: RespondToCommunityJoinRequestDto) {
    return this.database().$transaction(async (tx) => {
      await this.assertReviewer(tx, actorId, communityId);
      const request = await tx.communityJoinRequest.findUnique({ where: { id: requestId }, include: { community: { select: { id: true, name: true, ownerId: true, conversationId: true } } } });
      if (!request || request.communityId !== communityId || request.status !== CommunityJoinRequestStatus.PENDING) throw new NotFoundException("طلب الانضمام غير متاح للمراجعة");
      const accepted = dto.action === "APPROVE";
      const updated = await tx.communityJoinRequest.update({
        where: { id: request.id },
        data: { status: accepted ? CommunityJoinRequestStatus.APPROVED : CommunityJoinRequestStatus.REJECTED, reviewerId: actorId, respondedAt: new Date() },
        include: joinRequestInclude,
      });
      if (accepted) {
        const conversationId = await this.ensureConversation(tx, request.community);
        await tx.communityMember.upsert({ where: { communityId_userId: { communityId, userId: request.userId } }, create: { communityId, userId: request.userId }, update: {} });
        await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId: request.userId } }, create: { conversationId, userId: request.userId }, update: {} });
      }
      await this.audit(tx, communityId, actorId, accepted ? CommunityAuditAction.JOIN_REQUEST_APPROVED : CommunityAuditAction.JOIN_REQUEST_REJECTED, { targetUserId: request.userId });
      return updated;
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
      await this.audit(tx, communityId, userId, CommunityAuditAction.MEMBER_LEFT);
    });
    return { success: true };
  }

  async update(actorId: string, communityId: string, dto: UpdateCommunityDto) {
    return this.database().$transaction(async (tx) => {
      const actor = await this.actorFor(tx, actorId, communityId);
      if (actor.ownerId !== actorId) throw new ForbiddenException("إعدادات المجتمع متاحة للمالك فقط");
      const changedFields = Object.keys(dto).filter((key) => dto[key as keyof UpdateCommunityDto] !== undefined);
      const updated = await tx.community.update({
        where: { id: communityId }, data: { ...(dto.name !== undefined ? { name: dto.name } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}), ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}), ...(dto.visibility !== undefined ? { visibility: CommunityVisibility[dto.visibility] } : {}) }, include: communityInclude,
      });
      if (dto.name !== undefined && updated.conversationId) await tx.conversation.update({ where: { id: updated.conversationId }, data: { title: dto.name } });
      if (changedFields.length) await this.audit(tx, communityId, actorId, CommunityAuditAction.SETTINGS_UPDATED, { metadata: { changedFields } });
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
      const updated = await tx.communityMember.update({ where: { id: target.id }, data: { role: CommunityMemberRole[dto.role] }, include: memberInclude });
      await this.audit(tx, communityId, actorId, CommunityAuditAction.MEMBER_ROLE_UPDATED, { targetUserId: memberId, metadata: { previousRole: target.role, role: dto.role } });
      return updated;
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
      await this.audit(tx, communityId, actorId, CommunityAuditAction.MEMBER_REMOVED, { targetUserId: memberId });
    });
    return { success: true };
  }

  async transferOwnership(actorId: string, communityId: string, dto: TransferCommunityOwnershipDto) {
    return this.database().$transaction(async (tx) => {
      const actor = await this.actorFor(tx, actorId, communityId);
      if (actor.ownerId !== actorId) throw new ForbiddenException("نقل ملكية المجتمع متاح لمالكه فقط");
      if (dto.targetUserId === actorId) throw new BadRequestException("اختر عضواً آخر لنقل ملكية المجتمع إليه");
      const target = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: dto.targetUserId } }, select: { id: true } });
      if (!target) throw new NotFoundException("لا يمكن نقل الملكية إلا إلى عضو حالي في المجتمع");
      const updated = await tx.community.update({ where: { id: communityId }, data: { ownerId: dto.targetUserId }, include: communityInclude });
      await tx.communityMember.upsert({ where: { communityId_userId: { communityId, userId: dto.targetUserId } }, create: { communityId, userId: dto.targetUserId, role: CommunityMemberRole.ADMIN }, update: { role: CommunityMemberRole.ADMIN } });
      await tx.communityMember.upsert({ where: { communityId_userId: { communityId, userId: actorId } }, create: { communityId, userId: actorId, role: CommunityMemberRole.ADMIN }, update: { role: CommunityMemberRole.ADMIN } });
      await this.audit(tx, communityId, actorId, CommunityAuditAction.OWNERSHIP_TRANSFERRED, { targetUserId: dto.targetUserId });
      return updated;
    });
  }

  async listAuditLogs(actorId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      await this.assertReviewer(tx, actorId, communityId);
      return tx.communityAuditLog.findMany({ where: { communityId }, include: auditInclude, orderBy: { createdAt: "desc" }, take: 100 });
    });
  }

  async getConversation(userId: string, communityId: string) {
    return this.database().$transaction(async (tx) => {
      const community = await tx.community.findUnique({ where: { id: communityId }, select: { id: true, name: true, ownerId: true, conversationId: true } });
      if (!community) throw new NotFoundException("المجتمع غير موجود");
      const membership = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } }, select: { id: true } });
      if (!membership) throw new ForbiddenException("انضم إلى المجتمع أولاً للوصول إلى رسائله");
      const conversationId = await this.ensureConversation(tx, community);
      await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId } }, create: { conversationId, userId }, update: {} });
      return tx.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { participants: { include: { user: { select: person } } } } });
    });
  }

  async members(communityId: string) {
    await this.get(communityId);
    return this.database().communityMember.findMany({ where: { communityId }, include: memberInclude, orderBy: [{ role: "desc" }, { joinedAt: "asc" }] });
  }
}
