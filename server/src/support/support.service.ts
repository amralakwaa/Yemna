import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ReportTargetType, SupportTicketCategory } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReportDto, CreateSupportTicketDto } from "./dto/support.dto";
@Injectable()
export class SupportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }
  createTicket(userId: string, dto: CreateSupportTicketDto) { return this.database().supportTicket.create({ data: { userId, category: SupportTicketCategory[dto.category], subject: dto.subject, body: dto.body } }); }
  async tickets(userId: string) { return this.database().supportTicket.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }); }
  async ticket(userId: string, ticketId: string) { const ticket = await this.database().supportTicket.findFirst({ where: { id: ticketId, userId } }); if (!ticket) throw new NotFoundException("تذكرة الدعم غير موجودة"); return ticket; }
  createReport(userId: string, dto: CreateReportDto) { return this.database().contentReport.create({ data: { reporterId: userId, targetType: ReportTargetType[dto.targetType], targetId: dto.targetId, reason: dto.reason, details: dto.details } }); }
  reports(userId: string) { return this.database().contentReport.findMany({ where: { reporterId: userId }, orderBy: { updatedAt: "desc" } }); }
}
