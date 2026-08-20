import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationMaintenanceService } from "./notification-maintenance.service";
import { RealtimeEventsService } from "./realtime-events.service";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [RealtimeEventsService, RealtimeGateway, NotificationMaintenanceService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
