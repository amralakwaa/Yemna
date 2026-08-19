import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateCommunityDto } from "./dto/community.dto";
import { CommunitiesService } from "./communities.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@ApiTags("communities")
@Controller({ path: "communities", version: "1" })
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}
  @Get() list() { return this.communities.list(); }
  @Get(":id") get(@Param("id") id: string) { return this.communities.get(id); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCommunityDto) { return this.communities.create(req.user.sub, dto); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post(":id/join") join(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.communities.join(req.user.sub, id); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Delete(":id/leave") leave(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.communities.leave(req.user.sub, id); }
  @Get(":id/members") members(@Param("id") id: string) { return this.communities.members(id); }
}
