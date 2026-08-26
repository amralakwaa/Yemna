import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const trimmed = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) @Transform(trimmed)
  displayName!: string;
  @IsOptional() @IsEmail() @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{8,20}$/) @Transform(trimmed)
  phone?: string;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_]{3,30}$/) @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  username?: string;
  @IsString() @MinLength(10) @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsString() @MinLength(3) @MaxLength(320) @Transform(trimmed)
  identifier!: string;
  @IsString() @MinLength(10) @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsOptional() @IsString() @MinLength(32)
  refreshToken?: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(10) @MaxLength(128)
  currentPassword!: string;

  @IsString() @MinLength(10) @MaxLength(128)
  newPassword!: string;
}
