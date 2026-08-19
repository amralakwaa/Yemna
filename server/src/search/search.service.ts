import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AccountStatus, PostStatus, PostVisibility, CommunityVisibility, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const userSummary = { id: true, displayName: true, username: true, avatarUrl: true, bio: true, city: true, governorate: true } satisfies Prisma.UserSelect;

@Injectable()
export class SearchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }
  private term(query: string) { const term = query.trim(); if (term.length < 2) throw new BadRequestException("اكتب حرفين على الأقل للبحث"); return term; }
  async users(query: string) { const term = this.term(query); return this.database().user.findMany({ where: { status: AccountStatus.ACTIVE, OR: [{ displayName: { contains: term, mode: "insensitive" } }, { username: { contains: term, mode: "insensitive" } }, { city: { contains: term, mode: "insensitive" } }, { governorate: { contains: term, mode: "insensitive" } }] }, select: userSummary, take: 30, orderBy: { createdAt: "desc" } }); }
  async posts(query: string) { const term = this.term(query); return this.database().post.findMany({ where: { body: { contains: term, mode: "insensitive" }, status: PostStatus.PUBLISHED, visibility: PostVisibility.PUBLIC }, include: { author: { select: userSummary }, _count: { select: { comments: true, reactions: true } } }, take: 30, orderBy: { publishedAt: "desc" } }); }
  async communities(query: string) { const term = this.term(query); return this.database().community.findMany({ where: { visibility: CommunityVisibility.PUBLIC, OR: [{ name: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } }] }, include: { owner: { select: userSummary }, _count: { select: { members: true, posts: true } } }, take: 30, orderBy: { createdAt: "desc" } }); }
  async search(query: string, type: "all" | "users" | "posts" | "communities" = "all") {
    if (type === "users") return { users: await this.users(query) };
    if (type === "posts") return { posts: await this.posts(query) };
    if (type === "communities") return { communities: await this.communities(query) };
    const [users, posts, communities] = await Promise.all([this.users(query), this.posts(query), this.communities(query)]);
    return { users, posts, communities };
  }
}
