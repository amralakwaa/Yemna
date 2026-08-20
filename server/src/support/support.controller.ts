import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtPayload } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateReportDto, CreateSupportTicketDto } from "./dto/support.dto";
import { SupportService } from "./support.service";
type AuthenticatedRequest = Request & { user: JwtPayload };
@ApiTags("support") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller({ path: "support", version: "1" })
export class SupportController { constructor(@Inject(SupportService) private readonly support: SupportService) {} @Get("tickets") tickets(@Req() req: AuthenticatedRequest) { return this.support.tickets(req.user.sub); } @Post("tickets") createTicket(@Req() req: AuthenticatedRequest, @Body() dto: CreateSupportTicketDto) { return this.support.createTicket(req.user.sub, dto); } @Get("tickets/:id") ticket(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.support.ticket(req.user.sub, id); } @Get("reports") reports(@Req() req: AuthenticatedRequest) { return this.support.reports(req.user.sub); } @Post("reports") report(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) { return this.support.createReport(req.user.sub, dto); } }
