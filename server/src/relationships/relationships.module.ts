import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RelationshipsController } from "./relationships.controller";
import { RelationshipsService } from "./relationships.service";

@Module({ imports: [PrismaModule, AuthModule, NotificationsModule], controllers: [RelationshipsController], providers: [RelationshipsService], exports: [RelationshipsService] })
export class RelationshipsModule {}
