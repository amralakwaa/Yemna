import { IsString, MaxLength, MinLength } from "class-validator";

export class AssistantChatDto {
  @IsString({ message: "يجب أن تكون رسالة المساعد نصاً" })
  @MinLength(1, { message: "اكتب رسالة قبل الإرسال" })
  @MaxLength(2000, { message: "يجب ألا تتجاوز الرسالة 2000 حرف" })
  message!: string;
}
