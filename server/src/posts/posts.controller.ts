import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateCommentDto, CreatePostDto, ListPostsDto, ReactToPostDto, UpdateCommentDto, UpdatePostDto } from "./dto/post.dto";
import { PostsService } from "./posts.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller({ path: "posts", version: "1" })
export class PostsController {
  constructor(@Inject(PostsService) private readonly posts: PostsService) {}
  @Get() feed(@Query() query: ListPostsDto) { return this.posts.feed(query); }
  @Post() @UseGuards(JwtAuthGuard) create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePostDto) { return this.posts.create(req.user.sub, dto); }
  @Get(":id") get(@Param("id") id: string) { return this.posts.get(id); }
  @Get(":id/reactions") reactions(@Param("id") id: string) { return this.posts.listReactions(id); }
  @Get(":id/engagement") @UseGuards(JwtAuthGuard) engagement(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.posts.getEngagement(req.user.sub, id); }
  @Patch(":id") @UseGuards(JwtAuthGuard) update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdatePostDto) { return this.posts.update(req.user.sub, id, dto); }
  @Delete(":id") @UseGuards(JwtAuthGuard) remove(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.posts.remove(req.user.sub, id); }
  @Get(":id/comments") comments(@Param("id") id: string) { return this.posts.listComments(id); }
  @Post(":id/comments") @UseGuards(JwtAuthGuard) comment(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CreateCommentDto) { return this.posts.comment(req.user.sub, id, dto); }
  @Patch(":id/comments/:commentId") @UseGuards(JwtAuthGuard) updateComment(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Param("commentId") commentId: string, @Body() dto: UpdateCommentDto) { return this.posts.updateComment(req.user.sub, id, commentId, dto); }
  @Delete(":id/comments/:commentId") @UseGuards(JwtAuthGuard) removeComment(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Param("commentId") commentId: string) { return this.posts.removeComment(req.user.sub, id, commentId); }
  @Post(":id/reactions") @UseGuards(JwtAuthGuard) react(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: ReactToPostDto) { return this.posts.react(req.user.sub, id, dto); }
  @Post(":id/save") @UseGuards(JwtAuthGuard) save(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.posts.toggleSaved(req.user.sub, id); }
}
