import { GUARDS_METADATA, PATH_METADATA, VERSION_METADATA } from "@nestjs/common/constants";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AssistantController } from "./assistant.controller";
import { AssistantChatDto } from "./dto/assistant-chat.dto";

describe("AssistantController contract", () => {
  it("يمرر نص الطلب فقط إلى الخدمة", async () => {
    const assistant = { chat: vi.fn().mockResolvedValue({ reply: "من الخادم" }) };
    const controller = new AssistantController(assistant as never);

    await expect(controller.chat({ message: "رسالة" })).resolves.toEqual({ reply: "من الخادم" });
    expect(assistant.chat).toHaveBeenCalledWith("رسالة");
  });

  it("يسجل متحكم المساعد تحت المسار المحمي الصحيح", () => {
    expect(Reflect.getMetadata(PATH_METADATA, AssistantController)).toBe("assistant");
    expect(Reflect.getMetadata(VERSION_METADATA, AssistantController)).toBe("1");
    expect(Reflect.getMetadata(GUARDS_METADATA, AssistantController)).toContain(JwtAuthGuard);
  });

  it("يتحقق من النص المطلوب وحدوده قبل الوصول للخدمة", async () => {
    const empty = new AssistantChatDto();
    empty.message = "";
    const long = new AssistantChatDto();
    long.message = "ا".repeat(2001);

    expect(await validate(empty)).not.toHaveLength(0);
    expect(await validate(long)).not.toHaveLength(0);
  });
});
