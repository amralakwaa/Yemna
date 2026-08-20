import { ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { MediaKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStoryDto } from "./dto/story.dto";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const storyInclude = {
  author: { select: { id: true, displayName: true, username: true, fullName: true, avatarUrl: true } },
  media: true,
};

@Injectable()
export class StoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير متاحة حالياً");
  }

  list() {
    this.database();
    return this.prisma.story.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: storyInclude,
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  }

  async get(storyId: string) {
    this.database();
    const story = await this.prisma.story.findFirst({ where: { id: storyId, expiresAt: { gt: new Date() } }, include: storyInclude });
    if (!story) throw new NotFoundException("القصة غير متاحة أو انتهت مدتها");
    return story;
  }

  async create(userId: string, dto: CreateStoryDto) {
    this.database();
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: dto.mediaId, ownerId: userId, postId: null, story: null, kind: { in: [MediaKind.IMAGE, MediaKind.VIDEO] } },
      select: { id: true },
    });
    if (!media) throw new ForbiddenException("اختر صورة أو فيديو مرفوعاً من حسابك وغير مرتبط بمحتوى آخر");
    return this.prisma.story.create({
      data: { authorId: userId, mediaId: media.id, caption: dto.caption?.trim() || null, expiresAt: new Date(Date.now() + STORY_LIFETIME_MS) },
      include: storyInclude,
    });
  }

  async remove(userId: string, storyId: string) {
    this.database();
    const story = await this.prisma.story.findFirst({ where: { id: storyId } });
    if (!story) throw new NotFoundException("القصة غير موجودة");
    if (story.authorId !== userId) throw new ForbiddenException("لا يمكنك حذف قصة لا تخصك");
    await this.prisma.story.delete({ where: { id: storyId } });
    return { success: true };
  }
}
