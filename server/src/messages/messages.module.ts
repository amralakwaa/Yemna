import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
@Module({ imports: [PrismaModule, AuthModule, RealtimeModule, NotificationsModule], controllers: [MessagesController], providers: [MessagesService], exports: [MessagesService] })
export class MessagesModule {}
