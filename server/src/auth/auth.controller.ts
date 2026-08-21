import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { JwtPayload } from "./auth.types";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto, RegisterDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { YemnaEnv } from "../config/env";

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService<YemnaEnv, true>,
  ) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.register(dto, this.metadata(request));
    this.setRefreshCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user: tokens.user };
  }

  @Post("login") @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.login(dto, this.metadata(request));
    this.setRefreshCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user: tokens.user };
  }

  @Post("refresh") @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.refresh(dto.refreshToken ?? (request.cookies?.yemna_refresh_token as string | undefined) ?? "", this.metadata(request));
    this.setRefreshCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user: tokens.user };
  }

  @Post("logout") @HttpCode(204)
  async logout(@Body() dto: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(dto.refreshToken ?? (request.cookies?.yemna_refresh_token as string | undefined));
    response.clearCookie("yemna_refresh_token", { path: "/api/v1/auth" });
  }

  @Get("me") @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) { return request.user; }

  private metadata(request: Request) { return { ipAddress: request.ip, userAgent: request.get("user-agent") }; }
  private setRefreshCookie(response: Response, refreshToken: string) {
    const days = this.config.get("YEMNA_REFRESH_TOKEN_DAYS", { infer: true });
    response.cookie("yemna_refresh_token", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth", maxAge: days * 86_400_000 });
  }
}
