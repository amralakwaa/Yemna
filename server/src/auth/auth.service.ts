import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccountStatus, Prisma, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { DEVELOPMENT_JWT_ACCESS_SECRET, type YemnaEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthTokens, JwtPayload } from "./auth.types";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";

type RequestMetadata = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<YemnaEnv, true>
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata): Promise<AuthTokens> {
    this.assertDatabase();
    if (!dto.email && !dto.phone) throw new BadRequestException("Provide an email address or phone number.");
    const criteria: Prisma.UserWhereInput[] = [];
    if (dto.email) criteria.push({ email: dto.email });
    if (dto.phone) criteria.push({ phone: dto.phone });
    if (dto.username) criteria.push({ username: dto.username });
    const existing = await this.prisma.user.findFirst({ where: { OR: criteria } });
    if (existing) throw new ConflictException("An account already uses one of these identifiers.");
    const user = await this.prisma.user.create({ data: { displayName: dto.displayName, email: dto.email ?? null, phone: dto.phone ?? null, username: dto.username ?? null, passwordHash: await bcrypt.hash(dto.password, 12) } });
    return this.issueTokens(user, metadata);
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthTokens> {
    this.assertDatabase();
    const identifier = dto.identifier.toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: dto.identifier }, { username: identifier }] } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Invalid credentials.");
    if (user.status !== AccountStatus.ACTIVE) throw new UnauthorizedException("This account is not active.");
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user, metadata);
  }

  async refresh(rawToken: string, metadata: RequestMetadata): Promise<AuthTokens> {
    this.assertDatabase();
    const [sessionId, secret] = rawToken.split(".", 2);
    if (!sessionId || !secret) throw new UnauthorizedException("Refresh token is invalid or expired.");
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !(await bcrypt.compare(secret, session.tokenHash)) || session.user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }
    await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), lastActiveAt: new Date() } });
    return this.issueTokens(session.user, metadata);
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken || !this.prisma.isConfigured()) return;
    const [sessionId, secret] = rawToken.split(".", 2);
    if (!sessionId || !secret) return;
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
    if (session && !session.revokedAt && await bcrypt.compare(secret, session.tokenHash)) {
      await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    }
  }

  private async issueTokens(user: User, metadata: RequestMetadata): Promise<AuthTokens> {
    const secret = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.get("YEMNA_REFRESH_TOKEN_DAYS", { infer: true }) * 86_400_000);
    const session = await this.prisma.authSession.create({ data: { userId: user.id, tokenHash: await bcrypt.hash(secret, 12), expiresAt, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent?.slice(0, 512) } });
    const payload: JwtPayload = { sub: user.id, role: user.role, sessionId: session.id };
    const accessSecret = this.config.get("YEMNA_JWT_ACCESS_SECRET", { infer: true }) ?? this.config.get("JWT_SECRET", { infer: true }) ?? DEVELOPMENT_JWT_ACCESS_SECRET;
    const accessToken = await this.jwt.signAsync(payload, { secret: accessSecret, expiresIn: this.config.get("YEMNA_JWT_ACCESS_TTL", { infer: true }) });
    return { accessToken, refreshToken: `${session.id}.${secret}`, user: this.publicUser(user) };
  }

  private publicUser(user: User): AuthTokens["user"] {
    return { id: user.id, displayName: user.displayName, email: user.email, phone: user.phone, username: user.username, role: user.role };
  }

  private assertDatabase(): void {
    if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("Authentication database is not configured.");
  }
}
