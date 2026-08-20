import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateStoryDto } from "./dto/story.dto";
import { StoriesService } from "./stories.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@ApiTags("stories")
@Controller({ path: "stories", version: "1" })
export class StoriesController {
  constructor(@Inject(StoriesService) private readonly stories: StoriesService) {}

  @Get() list() { return this.stories.list(); }
  @Get(":id") get(@Param("id") id: string) { return this.stories.get(id); }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStoryDto) { return this.stories.create(req.user.sub, dto); }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.stories.remove(req.user.sub, id); }
}
