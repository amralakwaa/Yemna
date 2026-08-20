import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateStoryDto, ReplyToStoryDto } from "./dto/story.dto";
import { StoriesService } from "./stories.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@ApiTags("stories")
@Controller({ path: "stories", version: "1" })
export class StoriesController {
  constructor(@Inject(StoriesService) private readonly stories: StoriesService) {}

  @Get()
  list() { return this.stories.list(); }

  @Get("archive")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  archive(@Req() req: AuthenticatedRequest) { return this.stories.archive(req.user.sub); }

  @Get(":id")
  get(@Param("id") id: string) { return this.stories.get(id); }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStoryDto) { return this.stories.create(req.user.sub, dto); }

  @Post(":id/views")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  view(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.stories.recordView(req.user.sub, id); }

  @Get(":id/viewers")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  viewers(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.stories.viewers(req.user.sub, id); }

  @Post(":id/reply")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reply(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: ReplyToStoryDto) { return this.stories.reply(req.user.sub, id, dto); }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.stories.remove(req.user.sub, id); }
}
