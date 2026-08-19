import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  status() {
    return { status: "ok", service: "yemna-api", timestamp: new Date().toISOString(), database: this.prisma.isConfigured() ? "configured" : "not-configured" };
  }
}
