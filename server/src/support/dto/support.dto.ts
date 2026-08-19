import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export class CreateSupportTicketDto {
  @IsIn(["ACCOUNT", "TECHNICAL", "SAFETY", "OTHER"]) category!: "ACCOUNT" | "TECHNICAL" | "SAFETY" | "OTHER";
  @IsString() @MinLength(3) @MaxLength(180) @Transform(trim) subject!: string;
  @IsString() @MinLength(10) @MaxLength(4000) @Transform(trim) body!: string;
}
export class CreateReportDto {
  @IsIn(["POST", "COMMENT", "USER", "COMMUNITY", "MESSAGE"]) targetType!: "POST" | "COMMENT" | "USER" | "COMMUNITY" | "MESSAGE";
  @IsString() @MinLength(1) targetId!: string;
  @IsString() @MinLength(3) @MaxLength(180) @Transform(trim) reason!: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) details?: string;
}
