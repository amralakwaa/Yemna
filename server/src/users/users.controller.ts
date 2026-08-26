import { Body, Controller, Get, Inject, Param, Patch, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UpdateMyProfileDto, UpdateMySettingsDto } from "./dto/user.dto";
import { UsersService } from "./users.service";

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get("me") @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) { return this.users.me(request.user.sub); }

  @Patch("me") @UseGuards(JwtAuthGuard)
  updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateMyProfileDto) { return this.users.updateMe(request.user.sub, dto); }

  @Patch("me/settings") @UseGuards(JwtAuthGuard)
  updateSettings(@Req() request: AuthenticatedRequest, @Body() dto: UpdateMySettingsDto) { return this.users.updateSettings(request.user.sub, dto); }

  @Get("me/settings") @UseGuards(JwtAuthGuard)
  settings(@Req() request: AuthenticatedRequest) { return this.users.settings(request.user.sub); }

  @Get("me/data-export") @UseGuards(JwtAuthGuard)
  exportPersonalData(@Req() request: AuthenticatedRequest) { return this.users.exportPersonalData(request.user.sub); }

  @Get(":username")
  byUsername(@Param("username") username: string) { return this.users.byUsername(username.toLowerCase()); }
}
