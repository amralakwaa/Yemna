import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AppRole } from "@prisma/client";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminService } from "./admin.service";
import { UpdateAccountStatusDto, UpdateReportStatusDto, UpdateTicketStatusDto } from "./dto/admin.dto";
type AuthenticatedRequest = Request & { user: JwtPayload };
@ApiTags("admin") @ApiBearerAuth() @Roles(AppRole.ADMIN) @UseGuards(JwtAuthGuard, RolesGuard) @Controller({ path: "admin", version: "1" })
export class AdminController { constructor(private readonly admin: AdminService) {} @Get("stats") stats() { return this.admin.stats(); } @Get("users") users() { return this.admin.users(); } @Patch("users/:id/status") updateUser(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateAccountStatusDto) { return this.admin.updateUserStatus(req.user.sub, id, dto.status); } @Get("tickets") tickets() { return this.admin.tickets(); } @Patch("tickets/:id/status") updateTicket(@Param("id") id: string, @Body() dto: UpdateTicketStatusDto) { return this.admin.updateTicketStatus(id, dto.status); } @Get("reports") reports() { return this.admin.reports(); } @Patch("reports/:id/status") updateReport(@Param("id") id: string, @Body() dto: UpdateReportStatusDto) { return this.admin.updateReportStatus(id, dto.status); } }
