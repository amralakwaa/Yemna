import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AccountStatus, PostStatus, PostVisibility, CommunityVisibility, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const userSummary = { id: true, displayName: true, username: true, avatarUrl: true, bio: true, city: true, governorate: true } satisfies Prisma.UserSelect;

@Injectable()
export class SearchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }
  private term(query: string) { const term = query.trim(); if (term.length < 2) throw new BadRequestException("اكتب حرفين على الأقل للبحث"); return term; }
  async users(query: string, page = 1, limit = 30) {
    const term = this.term(query);
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
    const rows = await this.database().user.findMany({
      where: { status: AccountStatus.ACTIVE, OR: [{ displayName: { contains: term, mode: "insensitive" } }, { username: { contains: term, mode: "insensitive" } }, { city: { contains: term, mode: "insensitive" } }, { governorate: { contains: term, mode: "insensitive" } }] },
      select: userSummary,
      take: safeLimit + 1,
      skip: (safePage - 1) * safeLimit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { users: rows.slice(0, safeLimit), nextPage: rows.length > safeLimit ? safePage + 1 : null };
  }
  async posts(query: string) { const term = this.term(query); return this.database().post.findMany({ where: { body: { contains: term, mode: "insensitive" }, status: PostStatus.PUBLISHED, visibility: PostVisibility.PUBLIC }, include: { author: { select: userSummary }, _count: { select: { comments: true, reactions: true } } }, take: 30, orderBy: { publishedAt: "desc" } }); }
  async communities(query: string) { const term = this.term(query); return this.database().community.findMany({ where: { visibility: CommunityVisibility.PUBLIC, OR: [{ name: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } }] }, include: { owner: { select: userSummary }, _count: { select: { members: true, posts: true } } }, take: 30, orderBy: { createdAt: "desc" } }); }
  async search(query: string, type: "all" | "users" | "posts" | "communities" = "all", page = 1, limit = 30) {
    if (type === "users") {
      const result = await this.users(query, page, limit);
      return { users: result.users, usersNextPage: result.nextPage, posts: [], communities: [] };
    }
    if (type === "posts") return { users: [], posts: await this.posts(query), communities: [] };
    if (type === "communities") return { users: [], posts: [], communities: await this.communities(query) };
    const [users, posts, communities] = await Promise.all([this.users(query, page, limit), this.posts(query), this.communities(query)]);
    return { users: users.users, usersNextPage: users.nextPage, posts, communities };
  }
}
