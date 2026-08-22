import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CommunityMemberRole, CommunityVisibility, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommunityDto } from "./dto/community.dto";

const owner = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;
const communityInclude = { owner: { select: owner }, _count: { select: { members: true, posts: true } } } satisfies Prisma.CommunityInclude;

@Injectable()
export class CommunitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    return this.prisma;
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
    return this.database().community.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        coverUrl: dto.coverUrl,
        visibility: dto.visibility ? CommunityVisibility[dto.visibility] : CommunityVisibility.PUBLIC,
        ownerId,
        members: { create: { userId: ownerId, role: CommunityMemberRole.ADMIN } },
      },
      include: communityInclude,
    });
  }

  async join(userId: string, communityId: string) {
    const community = await this.database().community.findUnique({ where: { id: communityId }, select: { id: true, visibility: true } });
    if (!community) throw new NotFoundException("المجتمع غير موجود");
    if (community.visibility === CommunityVisibility.PRIVATE) throw new ForbiddenException("يتطلب هذا المجتمع موافقة الإدارة");
    return this.database().communityMember.upsert({ where: { communityId_userId: { communityId, userId } }, create: { communityId, userId }, update: {} });
  }

  async leave(userId: string, communityId: string) {
    const community = await this.database().community.findUnique({ where: { id: communityId }, select: { ownerId: true } });
    if (!community) throw new NotFoundException("المجتمع غير موجود");
    if (community.ownerId === userId) throw new BadRequestException("لا يمكن لمالك المجتمع مغادرته قبل نقل الملكية أو حذفه");
    await this.database().communityMember.deleteMany({ where: { communityId, userId } });
    return { success: true };
  }

  async members(communityId: string) {
    await this.get(communityId);
    return this.database().communityMember.findMany({
      where: { communityId },
      include: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true, bio: true } } },
      orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
    });
  }
}
