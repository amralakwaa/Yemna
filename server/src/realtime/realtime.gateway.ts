import { Inject, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { DEVELOPMENT_JWT_ACCESS_SECRET } from "../config/env";
import type { JwtPayload } from "../auth/auth.types";
import type { RealtimeEventName } from "./realtime.types";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "./realtime-events.service";

@WebSocketGateway({ namespace: "/realtime", cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnModuleDestroy {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private unsubscribe?: () => void;

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RealtimeEventsService) private readonly events: RealtimeEventsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  afterInit(): void {
    this.unsubscribe = this.events.subscribe(event => {
      this.server.to(`user:${event.recipientId}`).emit(event.name, event);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error("missing token");
      const secret = this.config.get<string>("YEMNA_JWT_ACCESS_SECRET") ?? this.config.get<string>("JWT_SECRET") ?? DEVELOPMENT_JWT_ACCESS_SECRET;
      const user = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
      client.data.user = user;
      await client.join(`user:${user.sub}`);
      client.emit("realtime:ready", { userId: user.sub });
    } catch {
      client.emit("realtime:error", { code: "UNAUTHORIZED", message: "تعذر توثيق الاتصال اللحظي" });
      client.disconnect(true);
    }
  }

  @SubscribeMessage("typing:start")
  typingStart(client: Socket, @MessageBody() body: { conversationId?: string }) {
    return this.broadcastConversation(client, body?.conversationId, "typing:start");
  }

  @SubscribeMessage("typing:stop")
  typingStop(client: Socket, @MessageBody() body: { conversationId?: string }) {
    return this.broadcastConversation(client, body?.conversationId, "typing:stop");
  }

  @SubscribeMessage("call:invite")
  callInvite(client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:invite", true);
  }

  @SubscribeMessage("call:answer")
  callAnswer(client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:answer");
  }

  @SubscribeMessage("call:candidate")
  callCandidate(client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:candidate");
  }

  @SubscribeMessage("call:decline")
  callDecline(client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:decline");
  }

  @SubscribeMessage("call:end")
  callEnd(client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:end");
  }

  @SubscribeMessage("call:busy")
  callBusy(client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:busy");
  }

  private async broadcastConversation(client: Socket, conversationId: string | undefined, name: "typing:start" | "typing:stop") {
    const userId = client.data.user?.sub as string | undefined;
    if (!userId || !conversationId || !this.prisma.isConfigured()) return { success: false };
    const member = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { conversationId: true } }).catch(() => null);
    if (!member) return { success: false };
    const recipients = await this.prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
    await Promise.all(recipients.map(recipient => this.events.emit(recipient.userId, name, { conversationId, userId })));
    return { success: true };
  }

  private async broadcastCallSignal(client: Socket, body: CallSignalBody | undefined, name: RealtimeEventName, requiresMode = false) {
    const userId = client.data.user?.sub as string | undefined;
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;
    const callId = typeof body?.callId === "string" ? body.callId : undefined;
    if (!userId || !conversationId || !callId || !this.prisma.isConfigured()) return { success: false };
    if (requiresMode && body?.mode !== "audio" && body?.mode !== "video") return { success: false };

    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { kind: true } }).catch(() => null);
    if (!conversation || conversation.kind !== "DIRECT") return { success: false };
    const member = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { conversationId: true } }).catch(() => null);
    if (!member) return { success: false };

    const recipients = await this.prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
    const caller = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, avatarUrl: true } }).catch(() => null);
    const payload: CallSignalPayload = {
      conversationId,
      callId,
      fromUserId: userId,
      ...(body?.mode === "audio" || body?.mode === "video" ? { mode: body.mode } : {}),
      ...(isSessionDescription(body?.description) ? { description: body.description } : {}),
      ...(isIceCandidate(body?.candidate) ? { candidate: body.candidate } : {}),
      ...(caller ? { caller } : {}),
    };
    await Promise.all(recipients.map(recipient => this.events.emit(recipient.userId, name, payload)));
    return { success: true };
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private extractToken(client: Socket): string | undefined {
    const handshakeToken = typeof client.handshake.auth.token === "string" ? client.handshake.auth.token : undefined;
    const authorization = typeof client.handshake.headers.authorization === "string" ? client.handshake.headers.authorization : undefined;
    const token = handshakeToken ?? authorization?.replace(/^Bearer\s+/i, "");
    return token?.trim() || undefined;
  }
}

type CallMode = "audio" | "video";
type CallSignalBody = {
  conversationId?: string;
  callId?: string;
  mode?: CallMode;
  description?: { type?: string; sdp?: string };
  candidate?: { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null };
};
type CallSignalPayload = {
  conversationId: string;
  callId: string;
  fromUserId: string;
  mode?: CallMode;
  description?: { type: string; sdp: string };
  candidate?: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null };
  caller?: { displayName: string; avatarUrl: string | null };
};

function isSessionDescription(value: CallSignalBody["description"]): value is { type: string; sdp: string } {
  return Boolean(value && typeof value.type === "string" && typeof value.sdp === "string" && value.sdp.length > 0);
}

function isIceCandidate(value: CallSignalBody["candidate"]): value is { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null } {
  return Boolean(value && typeof value.candidate === "string" && value.candidate.length > 0);
}
