import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AccountStatus, ReportStatus, SupportTicketStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private database() { if (!this.prisma.isConfigured()) throw new ServiceUnavailableException("قاعدة البيانات غير مهيأة"); return this.prisma; }
  async stats() { const db = this.database(); const [users, posts, communities, openTickets, openReports] = await Promise.all([db.user.count(), db.post.count(), db.community.count(), db.supportTicket.count({ where: { status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] } } }), db.contentReport.count({ where: { status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] } } })]); return { users, posts, communities, openTickets, openReports }; }
  users() { return this.database().user.findMany({ select: { id: true, email: true, phone: true, username: true, displayName: true, avatarUrl: true, role: true, status: true, createdAt: true, lastLoginAt: true }, orderBy: { createdAt: "desc" }, take: 100 }); }
  async updateUserStatus(actorId: string, userId: string, status: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION" | "DELETED") { if (actorId === userId && status !== "ACTIVE") throw new BadRequestException("لا يمكن للمشرف تعطيل حسابه من هذه الواجهة"); const result = await this.database().user.updateMany({ where: { id: userId }, data: { status: AccountStatus[status] } }); if (!result.count) throw new NotFoundException("المستخدم غير موجود"); return { success: true }; }
  tickets() { return this.database().supportTicket.findMany({ include: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }); }
  reports() { return this.database().contentReport.findMany({ include: { reporter: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }); }
  async updateTicketStatus(ticketId: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") { const result = await this.database().supportTicket.updateMany({ where: { id: ticketId }, data: { status: SupportTicketStatus[status] } }); if (!result.count) throw new NotFoundException("التذكرة غير موجودة"); return { success: true }; }
  async updateReportStatus(reportId: string, status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED") { const result = await this.database().contentReport.updateMany({ where: { id: reportId }, data: { status: ReportStatus[status] } }); if (!result.count) throw new NotFoundException("البلاغ غير موجود"); return { success: true }; }
}
