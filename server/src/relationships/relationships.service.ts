import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { FriendshipStatus, Prisma, RelationPermission } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const person = {
  id: true, displayName: true, fullName: true, username: true, avatarUrl: true, bio: true, city: true, governorate: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class RelationshipsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    return this.prisma;
  }

  private async assertTarget(actorId: string, targetId: string) {
    if (actorId === targetId) throw new BadRequestException("لا يمكن تنفيذ الإجراء على حسابك");
    const target = await this.database().user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw new NotFoundException("المستخدم غير موجود");
  }

  private async assertNotBlocked(actorId: string, targetId: string) {
    const block = await this.database().block.findFirst({ where: { OR: [{ blockerId: actorId, blockedId: targetId }, { blockerId: targetId, blockedId: actorId }] } });
    if (block) throw new ConflictException("لا يمكن تنفيذ الإجراء بسبب حالة الحظر");
  }

  private async assertRelationPermission(actorId: string, targetId: string, kind: "friendRequest" | "follow") {
    const target = await this.database().user.findUnique({ where: { id: targetId }, select: { id: true, settings: { select: { friendRequestPermission: true, followPermission: true } } } });
    const permission = kind === "friendRequest" ? target?.settings?.friendRequestPermission : target?.settings?.followPermission;
    if (!permission || permission === RelationPermission.EVERYONE) return;
    if (permission === RelationPermission.NOBODY) throw new ForbiddenException(kind === "friendRequest" ? "لا يستقبل هذا الحساب طلبات صداقة حالياً" : "لا يسمح هذا الحساب بالمتابعة حالياً");
    const friendship = await this.database().friendship.findFirst({ where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: actorId, recipientId: targetId }, { requesterId: targetId, recipientId: actorId }] }, select: { id: true } });
    if (!friendship) throw new ForbiddenException(kind === "friendRequest" ? "يسمح هذا الحساب بطلبات الصداقة من الأصدقاء فقط" : "يسمح هذا الحساب بالمتابعة من الأصدقاء فقط");
  }

  async sendFriendRequest(actorId: string, recipientId: string) {
    await this.assertTarget(actorId, recipientId);
    await this.assertNotBlocked(actorId, recipientId);
    await this.assertRelationPermission(actorId, recipientId, "friendRequest");
    const existing = await this.database().friendship.findFirst({ where: { OR: [{ requesterId: actorId, recipientId }, { requesterId: recipientId, recipientId: actorId }] } });
    if (existing?.status === FriendshipStatus.ACCEPTED) throw new ConflictException("أنتم أصدقاء بالفعل");
    if (existing?.status === FriendshipStatus.PENDING) throw new ConflictException("يوجد طلب صداقة قائم بالفعل");
    if (existing) return this.database().friendship.update({ where: { id: existing.id }, data: { requesterId: actorId, recipientId, status: FriendshipStatus.PENDING, respondedAt: null } });
    return this.database().friendship.create({ data: { requesterId: actorId, recipientId } });
  }

  async respondToFriendRequest(actorId: string, requestId: string, action: "accept" | "decline") {
    const request = await this.database().friendship.findUnique({ where: { id: requestId } });
    if (!request || request.recipientId !== actorId || request.status !== FriendshipStatus.PENDING) throw new NotFoundException("طلب الصداقة غير متاح");
    return this.database().friendship.update({ where: { id: requestId }, data: { status: action === "accept" ? FriendshipStatus.ACCEPTED : FriendshipStatus.DECLINED, respondedAt: new Date() } });
  }

  async listRequests(userId: string) {
    return this.database().friendship.findMany({ where: { recipientId: userId, status: FriendshipStatus.PENDING }, include: { requester: { select: person } }, orderBy: { createdAt: "desc" } });
  }

  async removeFriend(actorId: string, targetId: string) {
    await this.assertTarget(actorId, targetId);
    await this.database().friendship.deleteMany({
      where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: actorId, recipientId: targetId }, { requesterId: targetId, recipientId: actorId }] },
    });
    return { success: true as const };
  }

  async listFriends(userId: string) {
    const relations = await this.database().friendship.findMany({ where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: userId }, { recipientId: userId }] }, include: { requester: { select: person }, recipient: { select: person } }, orderBy: { updatedAt: "desc" } });
    return relations.map(relation => ({ id: relation.id, since: relation.respondedAt, user: relation.requesterId === userId ? relation.recipient : relation.requester }));
  }

  async follow(actorId: string, targetId: string) {
    await this.assertTarget(actorId, targetId);
    await this.assertNotBlocked(actorId, targetId);
    await this.assertRelationPermission(actorId, targetId, "follow");
    return this.database().follow.upsert({ where: { followerId_followedId: { followerId: actorId, followedId: targetId } }, create: { followerId: actorId, followedId: targetId }, update: {} });
  }

  async unfollow(actorId: string, targetId: string) {
    await this.database().follow.deleteMany({ where: { followerId: actorId, followedId: targetId } });
    return { success: true };
  }

  async followers(userId: string) {
    return this.database().follow.findMany({ where: { followedId: userId }, include: { follower: { select: person } }, orderBy: { createdAt: "desc" } });
  }

  async following(userId: string) {
    return this.database().follow.findMany({ where: { followerId: userId }, include: { followed: { select: person } }, orderBy: { createdAt: "desc" } });
  }

  async block(actorId: string, targetId: string) {
    await this.assertTarget(actorId, targetId);
    await this.database().$transaction([
      this.database().block.upsert({ where: { blockerId_blockedId: { blockerId: actorId, blockedId: targetId } }, create: { blockerId: actorId, blockedId: targetId }, update: {} }),
      this.database().friendship.deleteMany({ where: { OR: [{ requesterId: actorId, recipientId: targetId }, { requesterId: targetId, recipientId: actorId }] } }),
      this.database().follow.deleteMany({ where: { OR: [{ followerId: actorId, followedId: targetId }, { followerId: targetId, followedId: actorId }] } }),
    ]);
    return { success: true };
  }

  async unblock(actorId: string, targetId: string) {
    await this.database().block.deleteMany({ where: { blockerId: actorId, blockedId: targetId } });
    return { success: true };
  }

  async blocked(userId: string) {
    return this.database().block.findMany({ where: { blockerId: userId }, include: { blocked: { select: person } }, orderBy: { createdAt: "desc" } });
  }

  async suggestions(userId: string) {
    const blocked = await this.database().block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const excluded = new Set<string>([userId]);
    blocked.forEach(item => { excluded.add(item.blockerId); excluded.add(item.blockedId); });

    // The suggestions screen is a people directory, not only a mutual-friends list.
    // Keep it backed by real active accounts while hiding the current user and both
    // sides of a block relationship. Pagination can be added later without changing
    // the response contract used by the existing UI.
    return this.database().user.findMany({
      where: { id: { notIn: Array.from(excluded) }, status: "ACTIVE" },
      select: person,
      orderBy: { createdAt: "desc" },
    });
  }
}
