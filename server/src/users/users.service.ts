import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateMyProfileDto, UpdateMySettingsDto } from "./dto/user.dto";

const publicProfile = {
  id: true, displayName: true, fullName: true, username: true, avatarUrl: true, bio: true,
  city: true, governorate: true, role: true, createdAt: true,
} satisfies Prisma.UserSelect;

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
}
