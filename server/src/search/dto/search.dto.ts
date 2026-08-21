import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class SearchQueryDto {
  @IsString() @MaxLength(100)
  q!: string;
  @IsOptional() @IsIn(["all", "users", "posts", "communities"])
  type?: "all" | "users" | "posts" | "communities";
  @IsOptional() @IsInt() @Min(1)
  page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50)
  limit?: number;
}
