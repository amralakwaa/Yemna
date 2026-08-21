import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateConversationDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(99) @IsString({ each: true }) @Type(() => String)
  participantIds!: string[];
  @IsOptional() @IsString() @MaxLength(120) @Transform(trim)
  title?: string;
}

export class SendMessageDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) @Transform(trim)
  body?: string;
  @IsOptional() @IsString() @MaxLength(64)
  mediaId?: string;
}
