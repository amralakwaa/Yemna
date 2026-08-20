import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { PostVisibility, ReactionType } from "@prisma/client";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreatePostDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(5_000) @Transform(trim)
  body?: string;
  @IsOptional() @IsEnum(PostVisibility)
  visibility?: PostVisibility;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true })
  mediaIds?: string[];
}

export class UpdatePostDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(5_000) @Transform(trim)
  body?: string;
  @IsOptional() @IsEnum(PostVisibility)
  visibility?: PostVisibility;
}

export class ListPostsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
  @IsOptional() @IsString()
  cursor?: string;
}

export class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(2_000) @Transform(trim)
  body!: string;
  @IsOptional() @IsString()
  parentId?: string;
}

export class UpdateCommentDto {
  @IsString() @MinLength(1) @MaxLength(2_000) @Transform(trim)
  body!: string;
}

export class ReactToPostDto {
  @IsEnum(ReactionType)
  type!: ReactionType;
}
