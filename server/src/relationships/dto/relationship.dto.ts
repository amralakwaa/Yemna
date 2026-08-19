import { Transform } from "class-transformer";
import { IsIn, IsString, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class SendFriendRequestDto {
  @IsString() @MinLength(1) @Transform(trim)
  recipientId!: string;
}

export class RespondFriendRequestDto {
  @IsIn(["accept", "decline"])
  action!: "accept" | "decline";
}
