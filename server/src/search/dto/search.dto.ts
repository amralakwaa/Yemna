import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SearchQueryDto {
  @IsString() @MaxLength(100)
  q!: string;
  @IsOptional() @IsIn(["all", "users", "posts", "communities"])
  type?: "all" | "users" | "posts" | "communities";
}
