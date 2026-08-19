import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { MediaKind, Prisma } from "@prisma/client";
import { storagePut } from "../../storage";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAlbumDto, UploadMediaDto } from "./dto/media.dto";

type IncomingMedia = { buffer: Buffer; mimetype: string; originalname: string; size: number };
const mediaSelect = { id: true, kind: true, publicUrl: true, mimeType: true, byteSize: true, width: true, height: true, durationSeconds: true, createdAt: true, albumId: true, postId: true } satisfies Prisma.MediaAssetSelect;

@Injectable()
export class MediaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }

  private kindFor(mimeType: string) {
    if (mimeType.startsWith("image/")) return MediaKind.IMAGE;
    if (mimeType.startsWith("video/")) return MediaKind.VIDEO;
    if (mimeType.startsWith("audio/")) return MediaKind.AUDIO;
    if (["application/pdf", "text/plain"].includes(mimeType)) return MediaKind.DOCUMENT;
    throw new BadRequestException("نوع الملف غير مدعوم");
  }

  async list(ownerId: string, kind?: MediaKind, albumId?: string) {
    return this.database().mediaAsset.findMany({ where: { ownerId, ...(kind ? { kind } : {}), ...(albumId ? { albumId } : {}) }, select: mediaSelect, orderBy: { createdAt: "desc" } });
  }

  async createAlbum(ownerId: string, dto: CreateAlbumDto) {
    return this.database().album.create({ data: { ownerId, title: dto.title, description: dto.description, coverUrl: dto.coverUrl }, include: { _count: { select: { assets: true } } } });
  }

  async albums(ownerId: string) {
    return this.database().album.findMany({ where: { ownerId }, include: { _count: { select: { assets: true } } }, orderBy: { updatedAt: "desc" } });
  }

  async album(ownerId: string, albumId: string) {
    const album = await this.database().album.findFirst({ where: { id: albumId, ownerId }, include: { assets: { select: mediaSelect, orderBy: { createdAt: "desc" } } } });
    if (!album) throw new NotFoundException("الألبوم غير موجود");
    return album;
  }

  async upload(ownerId: string, dto: UploadMediaDto, file?: IncomingMedia) {
    if (!file?.buffer?.length || !file.mimetype) throw new BadRequestException("يجب إرفاق ملف صالح");
    if (file.size > 25 * 1024 * 1024) throw new BadRequestException("حجم الملف يتجاوز الحد المسموح");
    const kind = this.kindFor(file.mimetype);
    if (dto.albumId) await this.album(ownerId, dto.albumId);
    if (dto.postId) {
      const post = await this.database().post.findUnique({ where: { id: dto.postId }, select: { authorId: true } });
      if (!post) throw new NotFoundException("المنشور غير موجود");
      if (post.authorId !== ownerId) throw new ForbiddenException("لا يمكن إرفاق وسائط بمنشور لا تملكه");
    }
    const baseName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "upload";
    let stored: { key: string; url: string };
    try { stored = await storagePut(`yemna/users/${ownerId}/media/${baseName}`, file.buffer, file.mimetype); }
    catch { throw new ServiceUnavailableException("تعذر حفظ الملف حالياً"); }
    return this.database().mediaAsset.create({ data: { ownerId, postId: dto.postId, albumId: dto.albumId, kind, storageKey: stored.key, publicUrl: stored.url, mimeType: file.mimetype, byteSize: file.size }, select: mediaSelect });
  }

  async remove(ownerId: string, assetId: string) {
    const result = await this.database().mediaAsset.deleteMany({ where: { id: assetId, ownerId } });
    if (!result.count) throw new NotFoundException("الوسيط غير موجود");
    return { success: true };
  }
}
