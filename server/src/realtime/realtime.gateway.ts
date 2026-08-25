import { Inject, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { DEVELOPMENT_JWT_ACCESS_SECRET } from "../config/env";
import type { JwtPayload } from "../auth/auth.types";
import type { RealtimeEventName } from "./realtime.types";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
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
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
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
  typingStart(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    return this.broadcastConversation(client, body?.conversationId, "typing:start");
  }

  @SubscribeMessage("typing:stop")
  typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    return this.broadcastConversation(client, body?.conversationId, "typing:stop");
  }

  @SubscribeMessage("call:invite")
  callInvite(@ConnectedSocket() client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:invite", true);
  }

  @SubscribeMessage("call:answer")
  callAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:answer");
  }

  @SubscribeMessage("call:candidate")
  callCandidate(@ConnectedSocket() client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:candidate");
  }

  @SubscribeMessage("call:decline")
  callDecline(@ConnectedSocket() client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:decline");
  }

  @SubscribeMessage("call:end")
  callEnd(@ConnectedSocket() client: Socket, @MessageBody() body: CallSignalBody) {
    return this.broadcastCallSignal(client, body, "call:end");
  }

  @SubscribeMessage("call:busy")
  callBusy(@ConnectedSocket() client: Socket, @MessageBody() body: CallSignalBody) {
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

  private async broadcastCallSignal(client: Socket, body: CallSignalBody | undefined, name: RealtimeEventName, requiresMode = false): Promise<CallSignalReceipt> {
    const userId = client.data.user?.sub as string | undefined;
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;
    const callId = typeof body?.callId === "string" ? body.callId : undefined;
    if (!userId || !conversationId || !callId || !this.prisma.isConfigured()) return this.callReceipt(name, false, "invalid_request");
    if (requiresMode && body?.mode !== "audio" && body?.mode !== "video") return this.callReceipt(name, false, "invalid_mode");

    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { kind: true } }).catch(() => null);
    if (!conversation || conversation.kind !== "DIRECT") return this.callReceipt(name, false, "not_direct");
    const member = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { conversationId: true } }).catch(() => null);
    if (!member) return this.callReceipt(name, false, "not_member");

    const recipients = await this.prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } }).catch(() => []);
    if (recipients.length === 0) return this.callReceipt(name, false, "no_recipient");
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
    try {
      await Promise.all(recipients.map(recipient => this.events.emit(recipient.userId, name, payload)));
      if (name === "call:invite") {
        await Promise.allSettled(recipients.map(recipient => this.notifications.create({
          recipientId: recipient.userId,
          actorId: userId,
          type: "CALL_INVITE",
          title: `دعوة مكالمة ${body?.mode === "video" ? "فيديو" : "صوتية"} واردة`,
          linkUrl: `/messages?conversation=${encodeURIComponent(conversationId)}`,
          sourceKey: `call-invite:${callId}:${recipient.userId}`,
        })));
      }
      return this.callReceipt(name, true, undefined, recipients.length);
    } catch {
      return this.callReceipt(name, false, "delivery_failed");
    }
  }

  private callReceipt(name: RealtimeEventName, success: boolean, reason?: CallSignalReceipt["reason"], recipientCount = 0): CallSignalReceipt {
    // لا تسجل أي معرّفات مستخدمين أو مكالمات أو بيانات SDP/ICE أو إعدادات TURN.
    if (name !== "call:candidate") this.logger.log(`call_signal event=${name} outcome=${success ? "delivered" : reason ?? "rejected"} recipients=${recipientCount}`);
    return { success, ...(reason ? { reason } : {}), recipientCount };
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
type CallSignalReceipt = {
  success: boolean;
  reason?: "invalid_request" | "invalid_mode" | "not_direct" | "not_member" | "no_recipient" | "delivery_failed";
  recipientCount: number;
};

function isSessionDescription(value: CallSignalBody["description"]): value is { type: string; sdp: string } {
  return Boolean(value && typeof value.type === "string" && typeof value.sdp === "string" && value.sdp.length > 0);
}

function isIceCandidate(value: CallSignalBody["candidate"]): value is { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null } {
  return Boolean(value && typeof value.candidate === "string" && value.candidate.length > 0);
}
