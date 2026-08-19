import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CommunitiesModule } from "./communities/communities.module";
import { validateEnv } from "./config/env";
import { HealthModule } from "./health/health.module";
import { MediaModule } from "./media/media.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PostsModule } from "./posts/posts.module";
import { RelationshipsModule } from "./relationships/relationships.module";
import { SearchModule } from "./search/search.module";
import { SupportModule } from "./support/support.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PostsModule,
    RelationshipsModule,
    CommunitiesModule,
    MessagesModule,
    NotificationsModule,
    MediaModule,
    SearchModule,
    SupportModule,
    AdminModule,
  ],
})
export class AppModule {}
