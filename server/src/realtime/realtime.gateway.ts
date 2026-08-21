import { Inject, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { DEVELOPMENT_JWT_ACCESS_SECRET } from "../config/env";
import type { JwtPayload } from "../auth/auth.types";
import { RealtimeEventsService } from "./realtime-events.service";
import { PrismaService } from "../prisma/prisma.service";

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

  private async broadcastConversation(client: Socket, conversationId: string | undefined, name: "typing:start" | "typing:stop") {
    const userId = client.data.user?.sub as string | undefined;
    if (!userId || !conversationId || !this.prisma.isConfigured()) return { success: false };
    const member = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { conversationId: true } }).catch(() => null);
    if (!member) return { success: false };
    const recipients = await this.prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
    await Promise.all(recipients.map(recipient => this.events.emit(recipient.userId, name, { conversationId, userId })));
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
