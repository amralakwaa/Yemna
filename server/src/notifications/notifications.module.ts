import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
@Module({ imports: [PrismaModule, AuthModule, forwardRef(() => RealtimeModule)], controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
