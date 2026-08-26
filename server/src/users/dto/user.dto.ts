import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class UpdateMyProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Transform(trim)
  displayName?: string;

  @IsOptional() @IsString() @MaxLength(80) @Transform(trim)
  fullName?: string;

  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_]{3,30}$/) @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  username?: string;

  @IsOptional() @IsString() @MaxLength(500) @Transform(trim)
  bio?: string;

  @IsOptional() @IsString() @MaxLength(120) @Transform(trim)
  city?: string;

  @IsOptional() @IsString() @MaxLength(120) @Transform(trim)
  governorate?: string;

  @IsOptional() @IsString() @MaxLength(2_000) @Transform(trim)
  avatarUrl?: string;
}

export enum RelationPermissionDto {
  EVERYONE = "EVERYONE",
  FRIENDS = "FRIENDS",
  NOBODY = "NOBODY",
}

export class UpdateMySettingsDto {
  @IsOptional() @IsBoolean()
  showOnlineStatus?: boolean;

  @IsOptional() @IsBoolean()
  allowDirectMessages?: boolean;

  @IsOptional() @IsEnum(RelationPermissionDto)
  friendRequestPermission?: RelationPermissionDto;

  @IsOptional() @IsEnum(RelationPermissionDto)
  followPermission?: RelationPermissionDto;

  @IsOptional() @IsBoolean()
  notifyMessages?: boolean;

  @IsOptional() @IsBoolean()
  notifyFriendRequests?: boolean;

  @IsOptional() @IsBoolean()
  notifyFollows?: boolean;

  @IsOptional() @IsBoolean()
  notifyPostActivity?: boolean;

  @IsOptional() @IsBoolean()
  notifyCalls?: boolean;

  @IsOptional() @IsBoolean()
  notifyCommunities?: boolean;

  @IsOptional() @IsIn(["ar", "en"])
  locale?: "ar" | "en";

  @IsOptional() @Matches(/^[A-Z]{2}$/) @Transform(({ value }) => typeof value === "string" ? value.trim().toUpperCase() : value)
  region?: string;
}
