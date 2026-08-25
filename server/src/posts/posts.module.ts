import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";

@Module({ imports: [PrismaModule, AuthModule, NotificationsModule], controllers: [PostsController], providers: [PostsService], exports: [PostsService] })
export class PostsModule {}
