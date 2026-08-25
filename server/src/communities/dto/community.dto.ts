import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const normalizeSlug = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim().toLowerCase() : value;

export class CreateCommunityDto {
  @IsString() @MinLength(2) @MaxLength(100) @Transform(trim)
  name!: string;

  @IsString() @Matches(/^[a-z0-9-]{3,80}$/) @Transform(normalizeSlug)
  slug!: string;

  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim)
  description?: string;

  @IsOptional() @IsString() @MaxLength(2048) @Transform(trim)
  coverUrl?: string;

  @IsOptional() @IsIn(["PUBLIC", "PRIVATE"])
  visibility?: "PUBLIC" | "PRIVATE";
}

export class UpdateCommunityDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) @Transform(trim)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim)
  description?: string;

  @IsOptional() @IsString() @MaxLength(2048) @Transform(trim)
  coverUrl?: string;

  @IsOptional() @IsIn(["PUBLIC", "PRIVATE"])
  visibility?: "PUBLIC" | "PRIVATE";
}

export class UpdateCommunityMemberRoleDto {
  @IsIn(["MEMBER", "MODERATOR", "ADMIN"])
  role!: "MEMBER" | "MODERATOR" | "ADMIN";
}

export class RespondToCommunityJoinRequestDto {
  @IsIn(["APPROVE", "REJECT"])
  action!: "APPROVE" | "REJECT";
}

export class TransferCommunityOwnershipDto {
  @IsString() @MinLength(1) @MaxLength(191) @Transform(trim)
  targetUserId!: string;
}
