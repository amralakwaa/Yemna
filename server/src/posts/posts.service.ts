import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PostStatus, PostVisibility, Prisma, ReactionType } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto, CreatePostDto, ListPostsDto, ReactToPostDto, UpdateCommentDto, UpdatePostDto } from "./dto/post.dto";

const postInclude = {
  author: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
  media: true,
  _count: { select: { comments: true, reactions: true, savedBy: true, shares: true } },
} satisfies Prisma.PostInclude;

const publicUser = { id: true, displayName: true, username: true, avatarUrl: true } satisfies Prisma.UserSelect;
const reactionTypes = Object.values(ReactionType);
type ReactionSummary = Record<ReactionType, number>;

function emptyReactionSummary(): ReactionSummary {
  return reactionTypes.reduce((summary, type) => ({ ...summary, [type]: 0 }), {} as ReactionSummary);
}

@Injectable()
export class PostsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    return this.prisma;
  }

  private async reactionSummaries(postIds: string[]) {
    const summaries = new Map<string, ReactionSummary>(postIds.map(id => [id, emptyReactionSummary()]));
    if (!postIds.length) return summaries;
    const groups = await this.database().reaction.groupBy({
      by: ["postId", "type"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    });
    for (const group of groups) summaries.get(group.postId)![group.type] = group._count._all;
    return summaries;
  }

  private async withReactionSummaries<T extends { id: string }>(posts: T[]) {
    const summaries = await this.reactionSummaries(posts.map(post => post.id));
    return posts.map(post => ({ ...post, reactionSummary: summaries.get(post.id) ?? emptyReactionSummary() }));
  }

  private async findPost(id: string) {
    const post = await this.database().post.findFirst({ where: { id, status: { not: PostStatus.REMOVED } }, include: postInclude });
    if (!post) throw new NotFoundException("المنشور غير موجود");
    return post;
  }

  async feed(query: ListPostsDto) {
    const take = typeof query.limit === "number" ? query.limit : Number(query.limit) || 20;
    const rows = await this.database().post.findMany({
      where: { status: PostStatus.PUBLISHED, visibility: PostVisibility.PUBLIC },
      include: postInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return { items: await this.withReactionSummaries(items), nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async get(id: string) {
    const post = await this.findPost(id);
    return (await this.withReactionSummaries([post]))[0];
  }

  async create(authorId: string, dto: CreatePostDto) {
    const mediaIds = Array.from(new Set(dto.mediaIds ?? []));
    if (!dto.body && !mediaIds.length) throw new ForbiddenException("يجب إضافة نص أو وسائط للمنشور");
    const database = this.database();
    let media: Array<{ id: string }> = [];
    if (mediaIds.length) {
      media = await database.mediaAsset.findMany({
        where: { id: { in: mediaIds }, ownerId: authorId, postId: null },
        select: { id: true },
      });
      if (media.length !== mediaIds.length) throw new ForbiddenException("لا يمكن إرفاق وسائط غير مملوكة أو مرتبطة بمنشور آخر");
    }
    const post = await database.post.create({
      data: {
        authorId,
        body: dto.body || " ",
        visibility: dto.visibility ?? PostVisibility.PUBLIC,
        ...(media.length ? { media: { connect: media.map(asset => ({ id: asset.id })) } } : {}),
      },
      include: postInclude,
    });
    return (await this.withReactionSummaries([post]))[0];
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.get(id);
    if (post.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية تعديل هذا المنشور");
    const updated = await this.database().post.update({ where: { id }, data: { ...dto, editedAt: new Date() }, include: postInclude });
    return (await this.withReactionSummaries([updated]))[0];
  }

  async remove(userId: string, id: string) {
    const post = await this.get(id);
    if (post.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية حذف هذا المنشور");
    await this.database().post.update({ where: { id }, data: { status: PostStatus.REMOVED } });
    return { success: true };
  }

  async comment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.findPost(postId);
    if (dto.parentId) {
      const parent = await this.database().comment.findFirst({ where: { id: dto.parentId, postId } });
      if (!parent) throw new NotFoundException("التعليق الأب غير موجود");
      if (parent.parentId) throw new BadRequestException("يمكن الرد على تعليق رئيسي فقط");
    }
    const comment = await this.database().comment.create({ data: { postId, authorId: userId, body: dto.body, parentId: dto.parentId }, include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } } } });
    if (post.authorId !== userId) await this.notifications.create({ recipientId: post.authorId, actorId: userId, type: "POST_COMMENT", title: "علّق على منشورك", body: dto.body.slice(0, 180), linkUrl: `/posts/${encodeURIComponent(postId)}`, sourceKey: `post-comment:${comment.id}` }).catch(() => undefined);
    return comment;
  }

  async listComments(postId: string) {
    await this.findPost(postId);
    return this.database().comment.findMany({ where: { postId, parentId: null }, include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } }, replies: { include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } });
  }

  async updateComment(userId: string, postId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.database().comment.findFirst({ where: { id: commentId, postId } });
    if (!comment) throw new NotFoundException("التعليق غير موجود");
    if (comment.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية تعديل هذا التعليق");
    return this.database().comment.update({ where: { id: commentId }, data: { body: dto.body }, include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } } } });
  }

  async removeComment(userId: string, postId: string, commentId: string) {
    const comment = await this.database().comment.findFirst({ where: { id: commentId, postId }, include: { replies: { select: { id: true } } } });
    if (!comment) throw new NotFoundException("التعليق غير موجود");
    if (comment.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية حذف هذا التعليق");
    await this.database().comment.delete({ where: { id: commentId } });
    const post = await this.findPost(postId);
    if (post.authorId !== userId) {
      await Promise.all([commentId, ...comment.replies.map(reply => reply.id)].map(id => this.notifications.removeBySourceKey(post.authorId, `post-comment:${id}`).catch(() => undefined)));
    }
    return { success: true };
  }

  async react(userId: string, postId: string, dto: ReactToPostDto) {
    const post = await this.findPost(postId);
    const existing = await this.database().reaction.findFirst({ where: { userId, postId } });
    if (existing?.type === dto.type) {
      await this.database().reaction.deleteMany({ where: { userId, postId } });
      if (post.authorId !== userId) await this.notifications.removeBySourceKey(post.authorId, `post-reaction:${postId}:${userId}`).catch(() => undefined);
      return { active: false, type: dto.type, engagement: await this.engagement(postId, userId, false) };
    }
    await this.database().$transaction([
      this.database().reaction.deleteMany({ where: { userId, postId } }),
      this.database().reaction.create({ data: { userId, postId, type: dto.type } }),
    ]);
    if (post.authorId !== userId) await this.notifications.create({ recipientId: post.authorId, actorId: userId, type: "POST_REACTION", title: "تفاعل مع منشورك", body: dto.type, linkUrl: `/posts/${encodeURIComponent(postId)}`, sourceKey: `post-reaction:${postId}:${userId}` }).catch(() => undefined);
    return { active: true, type: dto.type, engagement: await this.engagement(postId, userId, false) };
  }

  async listReactions(postId: string, limit = 50) {
    await this.findPost(postId);
    return this.database().reaction.findMany({
      where: { postId },
      include: { user: { select: publicUser } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getEngagement(userId: string, postId: string) {
    await this.findPost(postId);
    return this.engagement(postId, userId, true);
  }

  private async engagement(postId: string, userId: string, includePreview: boolean) {
    const [summaries, viewerReaction, saved, reactors] = await Promise.all([
      this.reactionSummaries([postId]),
      this.database().reaction.findFirst({ where: { postId, userId }, select: { type: true } }),
      this.database().savedPost.findUnique({ where: { userId_postId: { userId, postId } }, select: { id: true } }),
      includePreview
        ? this.database().reaction.findMany({ where: { postId }, include: { user: { select: publicUser } }, orderBy: { createdAt: "desc" }, take: 5 })
        : Promise.resolve([]),
    ]);
    const reactionSummary = summaries.get(postId) ?? emptyReactionSummary();
    return {
      reactionSummary,
      reactionTotal: reactionTypes.reduce((total, type) => total + reactionSummary[type], 0),
      viewerReaction: viewerReaction?.type ?? null,
      saved: Boolean(saved),
      reactors,
    };
  }

  async toggleSaved(userId: string, postId: string) {
    await this.findPost(postId);
    const existing = await this.database().savedPost.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) { await this.database().savedPost.delete({ where: { id: existing.id } }); return { saved: false }; }
    await this.database().savedPost.create({ data: { userId, postId } });
    return { saved: true };
  }
}
