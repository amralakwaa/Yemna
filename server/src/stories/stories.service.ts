import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { MediaKind } from "@prisma/client";
import { MessagesService } from "../messages/messages.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStoryDto, ReplyToStoryDto } from "./dto/story.dto";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const storyInclude = {
  author: { select: { id: true, displayName: true, username: true, fullName: true, avatarUrl: true } },
  media: true,
};
const viewerSelect = { id: true, displayName: true, username: true, fullName: true, avatarUrl: true };

@Injectable()
export class StoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MessagesService) private readonly messages: MessagesService,
  ) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير متاحة حالياً");
    return this.prisma;
  }

  list() {
    return this.database().story.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: storyInclude,
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  }

  async get(storyId: string) {
    const story = await this.database().story.findFirst({ where: { id: storyId, expiresAt: { gt: new Date() } }, include: storyInclude });
    if (!story) throw new NotFoundException("القصة غير متاحة أو انتهت مدتها");
    return story;
  }

  async create(userId: string, dto: CreateStoryDto) {
    const database = this.database();
    const media = await database.mediaAsset.findFirst({
      where: { id: dto.mediaId, ownerId: userId, postId: null, story: null, kind: { in: [MediaKind.IMAGE, MediaKind.VIDEO] } },
      select: { id: true },
    });
    if (!media) throw new ForbiddenException("اختر صورة أو فيديو مرفوعاً من حسابك وغير مرتبط بمحتوى آخر");
    return database.story.create({
      data: { authorId: userId, mediaId: media.id, caption: dto.caption?.trim() || null, expiresAt: new Date(Date.now() + STORY_LIFETIME_MS) },
      include: storyInclude,
    });
  }

  async recordView(viewerId: string, storyId: string) {
    const story = await this.get(storyId);
    if (story.author.id === viewerId) return { success: true, recorded: false };
    await this.database().storyView.upsert({
      where: { storyId_viewerId: { storyId, viewerId } },
      create: { storyId, viewerId },
      update: { viewedAt: new Date() },
    });
    return { success: true, recorded: true };
  }

  async viewers(userId: string, storyId: string) {
    const story = await this.get(storyId);
    if (story.author.id !== userId) throw new ForbiddenException("لا يمكنك عرض مشاهدات قصة لا تخصك");
    const views = await this.database().storyView.findMany({
      where: { storyId },
      select: { viewedAt: true, viewer: { select: viewerSelect } },
      orderBy: { viewedAt: "desc" },
      take: 100,
    });
    return { count: views.length, viewers: views };
  }

  async reply(userId: string, storyId: string, dto: ReplyToStoryDto) {
    const story = await this.get(storyId);
    if (story.author.id === userId) throw new BadRequestException("لا يمكنك الرد على قصتك بنفسك");
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("لا يمكن إرسال رد فارغ");
    const conversation = await this.messages.findOrCreateDirectConversation(userId, story.author.id);
    return this.messages.send(userId, conversation.id, { body });
  }

  async remove(userId: string, storyId: string) {
    const story = await this.database().story.findFirst({ where: { id: storyId } });
    if (!story) throw new NotFoundException("القصة غير موجودة");
    if (story.authorId !== userId) throw new ForbiddenException("لا يمكنك حذف قصة لا تخصك");
    await this.database().story.delete({ where: { id: storyId } });
    return { success: true };
  }
}
