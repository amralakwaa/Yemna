import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AssistantService } from "./assistant.service";
import { AssistantChatDto } from "./dto/assistant-chat.dto";

@ApiTags("assistant")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "assistant", version: "1" })
export class AssistantController {
  constructor(@Inject(AssistantService) private readonly assistant: AssistantService) {}

  @Post("chat")
  chat(@Body() dto: AssistantChatDto) {
    return this.assistant.chat(dto.message);
  }
}
