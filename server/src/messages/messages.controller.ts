import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateConversationDto, SendMessageDto } from "./dto/message.dto";
import { MessagesService } from "./messages.service";

type AuthenticatedRequest = Request & { user: JwtPayload };
@ApiTags("messages") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller({ path: "messages", version: "1" })
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}
  @Get("conversations") conversations(@Req() req: AuthenticatedRequest) { return this.messages.conversations(req.user.sub); }
  @Post("conversations") create(@Req() req: AuthenticatedRequest, @Body() dto: CreateConversationDto) { return this.messages.create(req.user.sub, dto); }
  @Get("conversations/:id") messagesInConversation(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.messages.messages(req.user.sub, id); }
  @Post("conversations/:id/messages") send(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: SendMessageDto) { return this.messages.send(req.user.sub, id, dto); }
  @Patch("conversations/:id/read") read(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.messages.markRead(req.user.sub, id); }
}
