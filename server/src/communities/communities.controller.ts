import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateCommunityDto, UpdateCommunityDto, UpdateCommunityMemberRoleDto } from "./dto/community.dto";
import { CommunitiesService } from "./communities.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@ApiTags("communities")
@Controller({ path: "communities", version: "1" })
export class CommunitiesController {
  constructor(@Inject(CommunitiesService) private readonly communities: CommunitiesService) {}

  @Get() list() { return this.communities.list(); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get("mine") mine(@Req() req: AuthenticatedRequest) { return this.communities.listForUser(req.user.sub); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCommunityDto) { return this.communities.create(req.user.sub, dto); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch(":id") update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateCommunityDto) { return this.communities.update(req.user.sub, id, dto); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post(":id/join") join(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.communities.join(req.user.sub, id); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Delete(":id/leave") leave(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.communities.leave(req.user.sub, id); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get(":id/conversation") conversation(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.communities.getConversation(req.user.sub, id); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch(":id/members/:userId/role") setMemberRole(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Param("userId") userId: string, @Body() dto: UpdateCommunityMemberRoleDto) { return this.communities.setMemberRole(req.user.sub, id, userId, dto); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Delete(":id/members/:userId") removeMember(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Param("userId") userId: string) { return this.communities.removeMember(req.user.sub, id, userId); }
  @Get(":id/members") members(@Param("id") id: string) { return this.communities.members(id); }
  @Get(":id") get(@Param("id") id: string) { return this.communities.get(id); }
}
