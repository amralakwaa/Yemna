import { ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("../../_core/llm", () => ({ invokeLLM }));

import { AssistantService } from "./assistant.service";

describe("AssistantService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("يرسل رسالة المستخدم للنموذج الخادمي ويعيد النص فقط", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "  رد حقيقي من الخدمة  " } }] });
    const service = new AssistantService();

    await expect(service.chat("  اشرح لي يمنا  ")).resolves.toEqual({ reply: "رد حقيقي من الخدمة" });
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        { role: "user", content: "اشرح لي يمنا" },
      ]),
    }));
  });

  it("يرفض الرد الفارغ دون اختلاق بديل محلي", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "   " } }] });
    const service = new AssistantService();

    await expect(service.chat("مرحباً")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("يعرض خطأ خدمة آمن عند تعطل المزود ولا يكشف الخطأ الصاعد", async () => {
    invokeLLM.mockRejectedValue(new Error("upstream token must stay private"));
    const service = new AssistantService();

    await expect(service.chat("اختبار")).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ message: "خدمة مساعد يمنا غير متاحة حالياً. حاول مرة أخرى لاحقاً." }),
    });
  });
});
