import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CommunitiesController } from "./communities.controller";
import { CommunitiesService } from "./communities.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [CommunitiesController], providers: [CommunitiesService], exports: [CommunitiesService] })
export class CommunitiesModule {}
