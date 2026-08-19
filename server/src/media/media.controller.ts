import { Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { MediaKind } from "@prisma/client";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateAlbumDto, UploadMediaDto } from "./dto/media.dto";
import { MediaService } from "./media.service";

type AuthenticatedRequest = Request & { user: JwtPayload };
@ApiTags("media") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller({ path: "media", version: "1" })
export class MediaController {
  constructor(private readonly media: MediaService) {}
  @Get() list(@Req() req: AuthenticatedRequest, @Query("kind") kind?: MediaKind, @Query("albumId") albumId?: string) { return this.media.list(req.user.sub, kind, albumId); }
  @Get("albums") albums(@Req() req: AuthenticatedRequest) { return this.media.albums(req.user.sub); }
  @Post("albums") createAlbum(@Req() req: AuthenticatedRequest, @Body() dto: CreateAlbumDto) { return this.media.createAlbum(req.user.sub, dto); }
  @Get("albums/:id") album(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.media.album(req.user.sub, id); }
  @Post("upload") @ApiConsumes("multipart/form-data") @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } })) upload(@Req() req: AuthenticatedRequest, @Body() dto: UploadMediaDto, @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string; size: number }) { return this.media.upload(req.user.sub, dto, file); }
  @Delete(":id") remove(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.media.remove(req.user.sub, id); }
}
