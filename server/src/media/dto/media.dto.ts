import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateAlbumDto {
  @IsString() @MinLength(1) @MaxLength(120) @Transform(trim)
  title!: string;
  @IsOptional() @IsString() @MaxLength(500) @Transform(trim)
  description?: string;
  @IsOptional() @IsString() @MaxLength(2048) @Transform(trim)
  coverUrl?: string;
}

export class UploadMediaDto {
  @IsOptional() @IsString() @Transform(trim)
  postId?: string;
  @IsOptional() @IsString() @Transform(trim)
  albumId?: string;
}
