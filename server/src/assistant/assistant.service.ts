import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { invokeLLM } from "../../_core/llm";

const ASSISTANT_MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `أنت «مساعد يمنا»، مساعد نصي عربي لمنصة مجتمع يمنية.
أجب باللغة العربية الواضحة ما لم يطلب المستخدم لغة أخرى. كن مفيداً ومباشراً، واذكر حدود معرفتك وعدم اليقين عند الحاجة.
لا تدّعِ الوصول إلى حساب المستخدم أو رسائله أو بيانات المنصة أو الإنترنت، ولا تنفّذ إجراءات نيابة عنه.
لا تطلب أو تعِد بحفظ كلمات المرور أو الرموز أو البيانات الحساسة، ولا تعرضها في الرد.
لا تقدّم إجابتك على أنها حقيقة مؤكدة عندما تكون معلومة غير متحققة؛ شجّع المستخدم على الرجوع إلى مصدر مختص عند الضرورة.`;

function responseText(content: string | Array<{ type: string; text?: string }>) {
  if (typeof content === "string") return content.trim();
  return content
    .filter(part => part.type === "text" && typeof part.text === "string")
    .map(part => part.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

@Injectable()
export class AssistantService {
  async chat(message: string) {
    try {
      const result = await invokeLLM({
        model: ASSISTANT_MODEL,
        maxTokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message.trim() },
        ],
      });

      const reply = responseText(result.choices[0]?.message.content ?? "");
      if (!reply) {
        throw new Error("The LLM response did not contain usable text");
      }

      return { reply };
    } catch (error) {
      console.error("[assistant] LLM request failed", error instanceof Error ? error.name : "unknown-error");
      throw new ServiceUnavailableException("خدمة مساعد يمنا غير متاحة حالياً. حاول مرة أخرى لاحقاً.");
    }
  }
}
