import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RelationshipsController } from "./relationships.controller";
import { RelationshipsService } from "./relationships.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [RelationshipsController], providers: [RelationshipsService], exports: [RelationshipsService] })
export class RelationshipsModule {}
