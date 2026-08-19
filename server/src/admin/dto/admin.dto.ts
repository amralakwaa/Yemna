import { IsIn } from "class-validator";
export class UpdateAccountStatusDto { @IsIn(["ACTIVE", "DISABLED", "PENDING_VERIFICATION", "DELETED"]) status!: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION" | "DELETED"; }
export class UpdateTicketStatusDto { @IsIn(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) status!: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; }
export class UpdateReportStatusDto { @IsIn(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]) status!: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; }
