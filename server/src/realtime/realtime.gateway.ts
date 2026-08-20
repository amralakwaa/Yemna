import { Inject, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { DEVELOPMENT_JWT_ACCESS_SECRET } from "../config/env";
import type { JwtPayload } from "../auth/auth.types";
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
