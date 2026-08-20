import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StoriesController } from "./stories.controller";
import { StoriesService } from "./stories.service";

@Module({ imports: [PrismaModule, AuthModule, MessagesModule], controllers: [StoriesController], providers: [StoriesService], exports: [StoriesService] })
export class StoriesModule {}
