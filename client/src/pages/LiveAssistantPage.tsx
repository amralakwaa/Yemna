import { useState, type FormEvent } from "react";
import { CircleAlert, LoaderCircle, Lock, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/yemna/AppShell";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, ApiError } from "@/lib/api";
import "./live-assistant.css";

type AssistantMessage = { role: "user" | "assistant"; content: string };

export function LiveAssistantPage() {
  const { isAuthenticated, isLoading: sessionLoading } = useCurrentUser();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    const message = content.trim();
    if (!message || isSending) return;

    setError(null);
    setMessages(previous => [...previous, { role: "user", content: message }]);
    setIsSending(true);
    try {
      const { reply } = await api.chatWithAssistant(message);
      setMessages(previous => [...previous, { role: "assistant", content: reply }]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "تعذر الوصول إلى مساعد يمنا. حاول مرة أخرى لاحقاً.");
    } finally {
      setIsSending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = String(form.get("message") || "");
    if (!input.trim() || isSending) return;
    event.currentTarget.reset();
    void sendMessage(input);
  };

  if (sessionLoading) return <AppShell title="مساعد يمنا"><section className="live-assistant-state"><LoaderCircle className="animate-spin" size={28}/><p>يجري التحقق من جلسة الحساب…</p></section></AppShell>;
  if (!isAuthenticated) return <AppShell title="مساعد يمنا"><section className="live-assistant-state"><Lock size={28}/><h2>سجّل الدخول لاستخدام مساعد يمنا</h2><p>المحادثة مرتبطة بحسابك، ولا يتاح إرسال الطلبات من وضع الضيف.</p><Link className="button" href="/login">تسجيل الدخول</Link></section></AppShell>;

  return <AppShell title="مساعد يمنا"><main className="live-assistant" dir="rtl">
    <header className="live-assistant-head">
      <div className="live-assistant-mark" aria-hidden="true"><Sparkles size={24}/></div>
      <div><span className="eyebrow">ذكاء يمنا</span><h1>مساعد يمنا</h1><p>اسأل مساعداً نصياً للمساعدة العامة؛ لا يملك وصولاً إلى حسابك أو رسائلك أو بياناتك الخاصة.</p></div>
    </header>
    <section className="live-assistant-chat" aria-label="محادثة مع مساعد يمنا">
      {error && <div className="live-assistant-error" role="alert"><CircleAlert size={19}/><span>{error}</span></div>}
      <div className="live-assistant-panel">
        <div className="live-assistant-messages" aria-live="polite">
          {messages.length === 0 && <p className="live-assistant-empty">اكتب رسالتك لبدء محادثة جديدة. لا تُرسل كلمات المرور أو الرموز أو أي بيانات حساسة.</p>}
          {messages.map((message, index) => <article className={`live-assistant-message live-assistant-message--${message.role}`} key={`${message.role}-${index}`}><strong>{message.role === "user" ? "أنت" : "مساعد يمنا"}</strong><p>{message.content}</p></article>)}
          {isSending && <div className="live-assistant-typing"><LoaderCircle className="animate-spin" size={18}/><span>يجري إعداد الرد…</span></div>}
        </div>
        <form className="live-assistant-composer" onSubmit={submit}>
          <textarea name="message" aria-label="رسالتك إلى مساعد يمنا" placeholder="اكتب رسالتك إلى مساعد يمنا…" maxLength={2000} rows={3} disabled={isSending}/>
          <button className="button" type="submit" disabled={isSending} aria-label="إرسال الرسالة"><Send size={17}/>{isSending ? "جارٍ الإرسال…" : "إرسال"}</button>
        </form>
      </div>
    </section>
    <aside className="live-assistant-disclosure"><ShieldCheck size={18}/><p>قد يخطئ المساعد أو يقدم معلومات غير مكتملة. لا تُعامل إجاباته كبديل عن استشارة مختص في الموضوعات المهمة.</p></aside>
  </main></AppShell>;
}
