import { Controller, Get, Inject, VERSION_NEUTRAL, Version } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  status() {
    return this.health.status();
  }
}
