import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccountStatus, Prisma, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
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
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) throw new UnauthorizedException("رمز التحقق بخطوتين مطلوب");
      if (!user.twoFactorSecretEncrypted || !this.verifyTotp(this.decryptTwoFactorSecret(user.twoFactorSecretEncrypted), dto.twoFactorCode)) {
        throw new UnauthorizedException("رمز التحقق بخطوتين غير صحيح");
      }
    }
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

  async sessions(userId: string, currentSessionId: string) {
    this.assertDatabase();
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceName: true, userAgent: true, createdAt: true, lastActiveAt: true, expiresAt: true },
      orderBy: { lastActiveAt: "desc" },
      take: 30,
    });
    return sessions.map(session => ({
      id: session.id,
      deviceName: session.deviceName ?? this.deviceName(session.userAgent),
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, currentSessionId: string, sessionId: string) {
    this.assertDatabase();
    if (sessionId === currentSessionId) throw new BadRequestException("لا يمكن إنهاء الجلسة الحالية من هذه الصفحة");
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new BadRequestException("الجلسة غير متاحة أو انتهت بالفعل");
    return { success: true as const };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    this.assertDatabase();
    const result = await this.prisma.authSession.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { count: result.count };
  }

  async changePassword(userId: string, currentSessionId: string, dto: { currentPassword: string; newPassword: string }) {
    this.assertDatabase();
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, status: true } });
    if (!account || account.status !== AccountStatus.ACTIVE) throw new UnauthorizedException("بيانات الجلسة غير صالحة");
    if (!(await bcrypt.compare(dto.currentPassword, account.passwordHash))) throw new UnauthorizedException("كلمة المرور الحالية غير صحيحة");
    if (await bcrypt.compare(dto.newPassword, account.passwordHash)) throw new BadRequestException("اختر كلمة مرور جديدة مختلفة عن الحالية");

    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now } }),
      this.prisma.authSession.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    return { success: true as const };
  }

  async twoFactorStatus(userId: string) {
    this.assertDatabase();
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true, twoFactorPendingExpiresAt: true } });
    if (!account) throw new UnauthorizedException("بيانات الجلسة غير صالحة");
    return { enabled: account.twoFactorEnabled, setupPending: Boolean(account.twoFactorPendingExpiresAt && account.twoFactorPendingExpiresAt > new Date()) };
  }

  async setupTwoFactor(userId: string, dto: { currentPassword: string }) {
    this.assertDatabase();
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true, displayName: true, passwordHash: true, status: true, twoFactorEnabled: true } });
    if (!account || account.status !== AccountStatus.ACTIVE) throw new UnauthorizedException("بيانات الجلسة غير صالحة");
    if (account.twoFactorEnabled) throw new BadRequestException("التحقق بخطوتين مفعّل بالفعل");
    if (!(await bcrypt.compare(dto.currentPassword, account.passwordHash))) throw new UnauthorizedException("كلمة المرور الحالية غير صحيحة");
    const secret = this.createTotpSecret();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorPendingSecretEncrypted: this.encryptTwoFactorSecret(secret), twoFactorPendingExpiresAt: expiresAt } });
    const label = account.email ?? account.username ?? account.displayName;
    return { secret, expiresAt, otpauthUrl: `otpauth://totp/${encodeURIComponent(`Yemna:${label}`)}?secret=${secret}&issuer=Yemna&algorithm=SHA1&digits=6&period=30` };
  }

  async confirmTwoFactor(userId: string, currentSessionId: string, dto: { code: string }) {
    this.assertDatabase();
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true, twoFactorPendingSecretEncrypted: true, twoFactorPendingExpiresAt: true } });
    if (!account || account.twoFactorEnabled || !account.twoFactorPendingSecretEncrypted || !account.twoFactorPendingExpiresAt || account.twoFactorPendingExpiresAt <= new Date()) {
      throw new BadRequestException("جلسة إعداد التحقق بخطوتين غير متاحة أو انتهت");
    }
    const secret = this.decryptTwoFactorSecret(account.twoFactorPendingSecretEncrypted);
    if (!this.verifyTotp(secret, dto.code)) throw new BadRequestException("رمز التحقق غير صحيح");
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorSecretEncrypted: account.twoFactorPendingSecretEncrypted, twoFactorPendingSecretEncrypted: null, twoFactorPendingExpiresAt: null } }),
      this.prisma.authSession.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    return { success: true as const };
  }

  async disableTwoFactor(userId: string, currentSessionId: string, dto: { currentPassword: string; code: string }) {
    this.assertDatabase();
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, status: true, twoFactorEnabled: true, twoFactorSecretEncrypted: true } });
    if (!account || account.status !== AccountStatus.ACTIVE) throw new UnauthorizedException("بيانات الجلسة غير صالحة");
    if (!account.twoFactorEnabled || !account.twoFactorSecretEncrypted) throw new BadRequestException("التحقق بخطوتين غير مفعّل");
    if (!(await bcrypt.compare(dto.currentPassword, account.passwordHash))) throw new UnauthorizedException("كلمة المرور الحالية غير صحيحة");
    if (!this.verifyTotp(this.decryptTwoFactorSecret(account.twoFactorSecretEncrypted), dto.code)) throw new BadRequestException("رمز التحقق غير صحيح");
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecretEncrypted: null, twoFactorPendingSecretEncrypted: null, twoFactorPendingExpiresAt: null } }),
      this.prisma.authSession.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    return { success: true as const };
  }

  private async issueTokens(user: User, metadata: RequestMetadata): Promise<AuthTokens> {
    const secret = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.get("YEMNA_REFRESH_TOKEN_DAYS", { infer: true }) * 86_400_000);
    const session = await this.prisma.authSession.create({ data: { userId: user.id, tokenHash: await bcrypt.hash(secret, 12), expiresAt, deviceName: this.deviceName(metadata.userAgent), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent?.slice(0, 512) } });
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

  private deviceName(userAgent?: string | null) {
    const value = userAgent ?? "";
    if (/iPhone|Android.*Mobile/i.test(value)) return "هاتف محمول";
    if (/iPad|Android(?!.*Mobile)/i.test(value)) return "جهاز لوحي";
    if (/Windows/i.test(value)) return "كمبيوتر يعمل بنظام Windows";
    if (/Macintosh|Mac OS/i.test(value)) return "جهاز macOS";
    if (/Linux/i.test(value)) return "كمبيوتر يعمل بنظام Linux";
    return "جهاز غير معروف";
  }

  private createTotpSecret() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    return Array.from(randomBytes(20), byte => alphabet[byte % alphabet.length]).join("");
  }

  private verifyTotp(secret: string, code: string) {
    const expected = Buffer.from(code);
    return [-1, 0, 1].some(offset => {
      const candidate = Buffer.from(this.totp(secret, Math.floor(Date.now() / 30_000) + offset));
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
  }

  private totp(secret: string, counter: number) {
    const decoded = this.decodeBase32(secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac("sha1", decoded).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const value = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(value % 1_000_000).padStart(6, "0");
  }

  private decodeBase32(secret: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const character of secret.replace(/=+$/g, "").toUpperCase()) {
      const value = alphabet.indexOf(character);
      if (value < 0) throw new BadRequestException("مفتاح التحقق غير صالح");
      bits += value.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    return Buffer.from(bytes);
  }

  private twoFactorKey() {
    const accessSecret = this.config.get("YEMNA_JWT_ACCESS_SECRET", { infer: true }) ?? this.config.get("JWT_SECRET", { infer: true }) ?? DEVELOPMENT_JWT_ACCESS_SECRET;
    return createHash("sha256").update(accessSecret).digest();
  }

  private encryptTwoFactorSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.twoFactorKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
  }

  private decryptTwoFactorSecret(value: string) {
    try {
      const [ivValue, tagValue, ciphertextValue] = value.split(".");
      if (!ivValue || !tagValue || !ciphertextValue) throw new Error("invalid payload");
      const decipher = createDecipheriv("aes-256-gcm", this.twoFactorKey(), Buffer.from(ivValue, "base64url"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw new BadRequestException("تعذر قراءة إعداد التحقق بخطوتين بأمان");
    }
  }
}
