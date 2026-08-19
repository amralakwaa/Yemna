import { Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";
type AuthenticatedRequest = Request & { user: JwtPayload };
@ApiTags("notifications") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@Req() req: AuthenticatedRequest) { return this.notifications.list(req.user.sub); }
  @Patch("read-all") readAll(@Req() req: AuthenticatedRequest) { return this.notifications.markAllRead(req.user.sub); }
  @Patch(":id/read") read(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.notifications.markRead(req.user.sub, id); }
}
