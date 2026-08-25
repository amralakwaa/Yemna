import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CallsService } from "./calls.service";

@ApiTags("calls")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "calls", version: "1" })
export class CallsController {
  constructor(@Inject(CallsService) private readonly calls: CallsService) {}

  @Get("ice/status")
  iceStatus() {
    return this.calls.iceStatus();
  }

  @Get("ice")
  iceConfig() {
    return this.calls.iceConfig();
  }
}
