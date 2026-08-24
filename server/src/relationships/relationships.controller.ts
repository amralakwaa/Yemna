import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { RespondFriendRequestDto, SendFriendRequestDto } from "./dto/relationship.dto";
import { RelationshipsService } from "./relationships.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@ApiTags("relationships")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "relationships", version: "1" })
export class RelationshipsController {
  constructor(@Inject(RelationshipsService) private readonly relationships: RelationshipsService) {}

  @Get("friends") friends(@Req() req: AuthenticatedRequest) { return this.relationships.listFriends(req.user.sub); }
  @Delete("friends/:userId") removeFriend(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) { return this.relationships.removeFriend(req.user.sub, userId); }
  @Get("requests") requests(@Req() req: AuthenticatedRequest) { return this.relationships.listRequests(req.user.sub); }
  @Get("requests/sent") sentRequests(@Req() req: AuthenticatedRequest) { return this.relationships.listOutgoingRequests(req.user.sub); }
  @Post("requests") request(@Req() req: AuthenticatedRequest, @Body() dto: SendFriendRequestDto) { return this.relationships.sendFriendRequest(req.user.sub, dto.recipientId); }
  @Post("requests/:id/respond") respond(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: RespondFriendRequestDto) { return this.relationships.respondToFriendRequest(req.user.sub, id, dto.action); }
  @Delete("requests/:id") cancelRequest(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.relationships.cancelOutgoingFriendRequest(req.user.sub, id); }
  @Get("suggestions") suggestions(@Req() req: AuthenticatedRequest) { return this.relationships.suggestions(req.user.sub); }
  @Post("suggestions/:userId/dismiss") dismissSuggestion(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) { return this.relationships.dismissSuggestion(req.user.sub, userId); }
  @Get("followers") followers(@Req() req: AuthenticatedRequest) { return this.relationships.followers(req.user.sub); }
  @Get("following") following(@Req() req: AuthenticatedRequest) { return this.relationships.following(req.user.sub); }
  @Post("follow/:userId") follow(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) { return this.relationships.follow(req.user.sub, userId); }
  @Delete("follow/:userId") unfollow(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) { return this.relationships.unfollow(req.user.sub, userId); }
  @Get("blocked") blocked(@Req() req: AuthenticatedRequest) { return this.relationships.blocked(req.user.sub); }
  @Post("block/:userId") block(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) { return this.relationships.block(req.user.sub, userId); }
  @Delete("block/:userId") unblock(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) { return this.relationships.unblock(req.user.sub, userId); }
}
