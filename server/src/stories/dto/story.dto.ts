import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateStoryDto {
  @IsString()
  mediaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}

export class ReplyToStoryDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MaxLength(4000)
  body!: string;
}
