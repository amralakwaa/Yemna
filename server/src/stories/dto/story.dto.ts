import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateStoryDto {
  @IsString()
  mediaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
