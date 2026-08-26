import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateMyProfileDto, UpdateMySettingsDto } from "./dto/user.dto";

const publicProfile = {
  id: true, displayName: true, fullName: true, username: true, avatarUrl: true, bio: true,
  city: true, governorate: true, role: true, createdAt: true,
} satisfies Prisma.UserSelect;

const defaultSettings = {
  profileVisibility: "PUBLIC" as const,
  showOnlineStatus: true,
  allowDirectMessages: true,
  friendRequestPermission: "EVERYONE" as const,
  followPermission: "EVERYONE" as const,
  notifyMessages: true,
  notifyFriendRequests: true,
  notifyFollows: true,
  notifyPostActivity: true,
  notifyCalls: true,
  notifyCommunities: true,
  locale: "ar",
  region: "YE",
};

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private database() {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة");
    return this.prisma;
  }

  async me(userId: string) {
    // Keep session restoration independent from optional settings columns. Older
    // production databases may not have the relationship-privacy migration yet;
    // selecting UserSettings here would turn a valid authenticated request into a
    // 500 and make the client appear logged out after a refresh.
    const user = await this.database().user.findUnique({
      where: { id: userId },
      select: { ...publicProfile, email: true, phone: true, status: true },
    });
    if (!user) throw new NotFoundException("المستخدم غير موجود");
    return { ...user, settings: null };
  }

  async byUsername(username: string) {
    const value = username.trim();
    const user = await this.database().user.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ username: value.toLowerCase() }, { id: value }],
      },
      select: publicProfile,
    });
    if (!user) throw new NotFoundException("الملف الشخصي غير موجود");
    return user;
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    try {
      return await this.database().user.update({ where: { id: userId }, data: dto, select: publicProfile });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("اسم المستخدم أو بيانات الحساب مستخدمة بالفعل");
      }
      throw error;
    }
  }

  async updateSettings(userId: string, dto: UpdateMySettingsDto) {
    await this.me(userId);
    return this.database().userSettings.upsert({ where: { userId }, create: { userId, ...dto }, update: dto });
  }

  async settings(userId: string) {
    const account = await this.database().user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!account) throw new NotFoundException("المستخدم غير موجود");
    const settings = await this.database().userSettings.findUnique({ where: { userId } });
    return settings ?? { userId, ...defaultSettings };
  }

  async exportPersonalData(userId: string) {
    const account = await this.database().user.findUnique({
      where: { id: userId },
      select: {
        id: true, displayName: true, fullName: true, username: true, email: true, phone: true,
        avatarUrl: true, bio: true, city: true, governorate: true, status: true, createdAt: true,
        settings: true,
        posts: { select: { id: true, body: true, visibility: true, status: true, publishedAt: true, createdAt: true, updatedAt: true } },
        comments: { select: { id: true, postId: true, parentId: true, body: true, createdAt: true, updatedAt: true } },
        reactions: { select: { postId: true, type: true, createdAt: true } },
        commentReactions: { select: { commentId: true, type: true, createdAt: true } },
        savedPosts: { select: { postId: true, createdAt: true } },
        albums: { select: { id: true, title: true, description: true, coverUrl: true, createdAt: true, updatedAt: true } },
        mediaAssets: { select: { id: true, postId: true, albumId: true, messageId: true, kind: true, publicUrl: true, mimeType: true, byteSize: true, width: true, height: true, durationSeconds: true, createdAt: true } },
        stories: { select: { id: true, mediaId: true, caption: true, expiresAt: true, createdAt: true } },
        communityMemberships: { select: { communityId: true, role: true, joinedAt: true } },
        receivedNotifications: { select: { id: true, type: true, title: true, body: true, linkUrl: true, sourceKey: true, readAt: true, createdAt: true } },
      },
    });
    if (!account) throw new NotFoundException("المستخدم غير موجود");
    const { settings, posts, comments, reactions, commentReactions, savedPosts, albums, mediaAssets, stories, communityMemberships, receivedNotifications, ...profile } = account;
    return {
      format: "yemna-account-export/v1",
      exportedAt: new Date().toISOString(),
      account: profile,
      settings: settings ?? { userId, ...defaultSettings },
      content: { posts, comments, reactions, commentReactions, savedPosts, albums, mediaAssets, stories, communityMemberships },
      notifications: receivedNotifications,
      exclusions: ["password hashes", "refresh tokens", "session identifiers", "security secrets", "other users' private data"],
    };
  }
}
