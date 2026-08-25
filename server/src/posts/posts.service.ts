import { ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PostStatus, PostVisibility, Prisma, ReactionType } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto, CreatePostDto, ListPostsDto, ReactToPostDto, UpdateCommentDto, UpdatePostDto } from "./dto/post.dto";

const postInclude = {
  author: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
  media: true,
  _count: { select: { comments: true, reactions: true, savedBy: true, shares: true } },
} satisfies Prisma.PostInclude;

@Injectable()
export class PostsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    return this.prisma;
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
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async get(id: string) {
    const post = await this.database().post.findFirst({ where: { id, status: { not: PostStatus.REMOVED } }, include: postInclude });
    if (!post) throw new NotFoundException("المنشور غير موجود");
    return post;
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
    return database.post.create({
      data: {
        authorId,
        body: dto.body || " ",
        visibility: dto.visibility ?? PostVisibility.PUBLIC,
        ...(media.length ? { media: { connect: media.map(asset => ({ id: asset.id })) } } : {}),
      },
      include: postInclude,
    });
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.get(id);
    if (post.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية تعديل هذا المنشور");
    return this.database().post.update({ where: { id }, data: { ...dto, editedAt: new Date() }, include: postInclude });
  }

  async remove(userId: string, id: string) {
    const post = await this.get(id);
    if (post.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية حذف هذا المنشور");
    await this.database().post.update({ where: { id }, data: { status: PostStatus.REMOVED } });
    return { success: true };
  }

  async comment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.get(postId);
    if (dto.parentId) {
      const parent = await this.database().comment.findFirst({ where: { id: dto.parentId, postId } });
      if (!parent) throw new NotFoundException("التعليق الأب غير موجود");
    }
    const comment = await this.database().comment.create({ data: { postId, authorId: userId, body: dto.body, parentId: dto.parentId }, include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } } } });
    if (post.authorId !== userId) await this.notifications.create({ recipientId: post.authorId, actorId: userId, type: "POST_COMMENT", title: "علّق على منشورك", body: dto.body.slice(0, 180), linkUrl: `/posts/${encodeURIComponent(postId)}`, sourceKey: `post-comment:${comment.id}` }).catch(() => undefined);
    return comment;
  }

  async listComments(postId: string) {
    await this.get(postId);
    return this.database().comment.findMany({ where: { postId, parentId: null }, include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } }, replies: { include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } });
  }

  async updateComment(userId: string, postId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.database().comment.findFirst({ where: { id: commentId, postId } });
    if (!comment) throw new NotFoundException("التعليق غير موجود");
    if (comment.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية تعديل هذا التعليق");
    return this.database().comment.update({ where: { id: commentId }, data: { body: dto.body }, include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true } } } });
  }

  async removeComment(userId: string, postId: string, commentId: string) {
    const comment = await this.database().comment.findFirst({ where: { id: commentId, postId } });
    if (!comment) throw new NotFoundException("التعليق غير موجود");
    if (comment.authorId !== userId) throw new ForbiddenException("لا تملك صلاحية حذف هذا التعليق");
    await this.database().comment.delete({ where: { id: commentId } });
    const post = await this.get(postId);
    if (post.authorId !== userId) await this.notifications.removeBySourceKey(post.authorId, `post-comment:${commentId}`).catch(() => undefined);
    return { success: true };
  }

  async react(userId: string, postId: string, dto: ReactToPostDto) {
    const post = await this.get(postId);
    const same = await this.database().reaction.findFirst({ where: { userId, postId, type: dto.type } });
    if (same) {
      await this.database().reaction.delete({ where: { id: same.id } });
      if (post.authorId !== userId) await this.notifications.removeBySourceKey(post.authorId, `post-reaction:${postId}:${userId}`).catch(() => undefined);
      return { active: false, type: dto.type };
    }
    await this.database().$transaction([
      this.database().reaction.deleteMany({ where: { userId, postId } }),
      this.database().reaction.create({ data: { userId, postId, type: dto.type } }),
    ]);
    if (post.authorId !== userId) await this.notifications.create({ recipientId: post.authorId, actorId: userId, type: "POST_REACTION", title: "تفاعل مع منشورك", body: dto.type, linkUrl: `/posts/${encodeURIComponent(postId)}`, sourceKey: `post-reaction:${postId}:${userId}` }).catch(() => undefined);
    return { active: true, type: dto.type };
  }

  async toggleSaved(userId: string, postId: string) {
    await this.get(postId);
    const existing = await this.database().savedPost.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) { await this.database().savedPost.delete({ where: { id: existing.id } }); return { saved: false }; }
    await this.database().savedPost.create({ data: { userId, postId } });
    return { saved: true };
  }
}
