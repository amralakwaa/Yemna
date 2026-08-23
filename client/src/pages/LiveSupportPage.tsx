import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CheckCircle2, CircleAlert, FileWarning, Headphones, LoaderCircle, MessageSquareText, RefreshCw, Send, TicketCheck, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, asRelativeTime, type ApiContentReport, type ApiSupportTicket } from "@/lib/api";
import "./live-support.css";

type SupportView = "home" | "ticket" | "tickets" | "reports";
type TicketCategory = ApiSupportTicket["category"];
type ReportTarget = ApiContentReport["targetType"];

const ticketCategories: Array<{ value: TicketCategory; label: string }> = [
  { value: "TECHNICAL", label: "مشكلة تقنية" },
  { value: "ACCOUNT", label: "الحساب وتسجيل الدخول" },
  { value: "SAFETY", label: "الخصوصية والأمان" },
  { value: "OTHER", label: "أخرى" },
];

const reportTargets: Array<{ value: ReportTarget; label: string }> = [
  { value: "POST", label: "منشور" },
  { value: "COMMENT", label: "تعليق" },
  { value: "USER", label: "حساب مستخدم" },
  { value: "COMMUNITY", label: "مجتمع" },
  { value: "MESSAGE", label: "رسالة" },
];

function viewFor(location: string): SupportView {
  if (location === "/help/report" || location === "/help/contact") return "ticket";
  if (location === "/help/report/status") return "tickets";
  if (location === "/support/reports") return "reports";
  return "home";
}

function ticketStatus(status: string) {
  return status === "CLOSED" ? "مغلق" : status === "RESOLVED" ? "تم الحل" : status === "IN_PROGRESS" ? "قيد المعالجة" : "مفتوح";
}

function reportStatus(status: string) {
  return status === "RESOLVED" ? "تمت المعالجة" : status === "DISMISSED" ? "أُغلق" : status === "REVIEWING" ? "قيد المراجعة" : "مفتوح";
}

function GuestState({ title, text }: { title: string; text: string }) {
  return <Surface className="support-state"><Headphones size={30}/><h2>{title}</h2><p>{text}</p><Link className="button" href="/login">تسجيل الدخول</Link></Surface>;
}

export function LiveSupportPage() {
  const [location, navigate] = useLocation();
  const view = viewFor(location);
  const { isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<TicketCategory>("TECHNICAL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<ReportTarget>("POST");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const tickets = useQuery({ queryKey: ["rest", "support", "tickets"], queryFn: api.getSupportTickets, enabled: isAuthenticated, retry: 1 });
  const reports = useQuery({ queryKey: ["rest", "support", "reports"], queryFn: api.getSupportReports, enabled: isAuthenticated && view === "reports", retry: 1 });
  const createTicket = useMutation({
    mutationFn: api.createSupportTicket,
    onSuccess: async () => {
      setSubject(""); setBody("");
      await queryClient.invalidateQueries({ queryKey: ["rest", "support", "tickets"] });
      toast.success("تم إرسال طلب الدعم");
      navigate("/help/report/status");
    },
    onError: () => toast.error("تعذر إرسال الطلب، حاول لاحقاً"),
  });
  const createReport = useMutation({
    mutationFn: api.createSupportReport,
    onSuccess: async () => {
      setTargetId(""); setReason(""); setDetails("");
      await queryClient.invalidateQueries({ queryKey: ["rest", "support", "reports"] });
      toast.success("تم إرسال البلاغ");
    },
    onError: () => toast.error("تعذر إرسال البلاغ، تحقق من البيانات ثم حاول لاحقاً"),
  });
  const title = view === "ticket" ? "طلب دعم" : view === "tickets" ? "حالة طلباتي" : view === "reports" ? "بلاغاتي" : "مركز الدعم";
  const ticketCount = useMemo(() => Array.isArray(tickets.data) ? tickets.data.length : 0, [tickets.data]);

  if (isSessionLoading) return <AppShell title={title}><Surface className="support-state"><LoaderCircle className="animate-spin" size={28}/><p>يجري التحقق من جلسة الحساب…</p></Surface></AppShell>;
  if (!isAuthenticated) return <AppShell title={title}><GuestState title="سجّل الدخول للوصول إلى الدعم" text="تُحفظ طلبات الدعم وبلاغاتك ضمن حسابك لكي يمكنك متابعتها بأمان."/></AppShell>;

  return <AppShell title={title}><main className="live-support-page">
    {view === "home" && <>
      <Surface className="support-hero"><span className="eyebrow">يمنا · الدعم</span><h2>كيف يمكننا مساعدتك؟</h2><p>أرسل طلباً موثقاً إلى فريق الدعم، أو تابع حالة طلباتك وبلاغاتك من حسابك.</p></Surface>
      <section className="support-actions" aria-label="خدمات الدعم">
        <Link href="/help/report"><MessageSquareText/><span><strong>إرسال طلب دعم</strong><small>للحسابات والمشكلات التقنية والخصوصية.</small></span></Link>
        <Link href="/help/report/status"><TicketCheck/><span><strong>حالة طلباتي</strong><small>{ticketCount ? `${ticketCount} طلب مسجل في حسابك` : "لا توجد طلبات مرسلة بعد."}</small></span></Link>
        <Link href="/support/reports"><FileWarning/><span><strong>بلاغات المحتوى</strong><small>أرسل بلاغاً عن منشور أو حساب أو رسالة محددة.</small></span></Link>
      </section>
      <Surface className="support-honesty"><CircleAlert size={20}/><p>لا تتوفر حالياً قاعدة معرفة أو محادثة فورية مع الدعم؛ الخيارات أعلاه مرتبطة فقط بالتذاكر والبلاغات المحفوظة فعلياً.</p></Surface>
    </>}

    {view === "ticket" && <Surface className="support-form-card"><div className="support-form-head"><span className="eyebrow">طلب جديد</span><h2>أخبرنا بما حدث</h2><p>اكتب وصفاً واضحاً للمشكلة. لا تضع كلمات المرور أو رموز التحقق في الطلب.</p></div><form onSubmit={event => { event.preventDefault(); if (subject.trim().length < 3 || body.trim().length < 10) return toast.error("اكتب عنواناً من 3 أحرف ووصفاً من 10 أحرف على الأقل"); createTicket.mutate({ category, subject: subject.trim(), body: body.trim() }); }}>
      <label>تصنيف الطلب<select value={category} onChange={event => setCategory(event.target.value as TicketCategory)}>{ticketCategories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>عنوان مختصر<input value={subject} maxLength={180} onChange={event => setSubject(event.target.value)} placeholder="مثال: لا تصلني الإشعارات" required/></label>
      <label>وصف المشكلة<textarea value={body} maxLength={4000} onChange={event => setBody(event.target.value)} placeholder="متى بدأت المشكلة؟ وما الذي حدث؟" required/></label>
      <div className="support-form-actions"><Link href="/help" className="button ghost">إلغاء</Link><button type="submit" className="button" disabled={createTicket.isPending}><Send size={17}/>{createTicket.isPending ? "جارٍ الإرسال…" : "إرسال الطلب"}</button></div>
    </form></Surface>}

    {view === "tickets" && <><SupportList<ApiSupportTicket> data={tickets.data} isLoading={tickets.isLoading} isError={tickets.isError} refetch={tickets.refetch} title="طلبات الدعم" emptyTitle="لا توجد طلبات دعم بعد" emptyText="عند إرسال طلب جديد سيظهر هنا مع آخر حالة له." render={ticket => <article className="support-record" key={ticket.id}><i><TicketCheck size={18}/></i><div><strong>{ticket.subject}</strong><p>{ticketCategories.find(item => item.value === ticket.category)?.label || ticket.category} · {asRelativeTime(ticket.updatedAt || ticket.createdAt)}</p></div><span>{ticketStatus(ticket.status)}</span></article>}/><Link className="button support-new-action" href="/help/report"><Send size={17}/>إرسال طلب جديد</Link></>}

    {view === "reports" && <div className="support-reports-grid"><Surface className="support-form-card"><div className="support-form-head"><span className="eyebrow">بلاغ محتوى</span><h2>إرسال بلاغ محدد</h2><p>يلزم تحديد نوع العنصر ومعرّفه حتى يمكن لفريق الإشراف مراجعة البلاغ.</p></div><form onSubmit={event => { event.preventDefault(); if (!targetId.trim() || reason.trim().length < 3) return toast.error("أدخل معرّف العنصر وسبب البلاغ بوضوح"); createReport.mutate({ targetType, targetId: targetId.trim(), reason: reason.trim(), details: details.trim() || undefined }); }}>
        <label>نوع المحتوى<select value={targetType} onChange={event => setTargetType(event.target.value as ReportTarget)}>{reportTargets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>معرّف المحتوى أو الحساب<input value={targetId} onChange={event => setTargetId(event.target.value)} placeholder="المعرّف الظاهر في رابط المحتوى" required/></label>
        <label>سبب البلاغ<input value={reason} maxLength={180} onChange={event => setReason(event.target.value)} placeholder="مثال: انتحال شخصية" required/></label>
        <label>تفاصيل إضافية (اختياري)<textarea value={details} maxLength={2000} onChange={event => setDetails(event.target.value)} placeholder="أي سياق مفيد للمراجعة"/></label>
        <button type="submit" className="button" disabled={createReport.isPending}><Send size={17}/>{createReport.isPending ? "جارٍ الإرسال…" : "إرسال البلاغ"}</button>
      </form></Surface><SupportList<ApiContentReport> data={reports.data} isLoading={reports.isLoading} isError={reports.isError} refetch={reports.refetch} title="بلاغاتي" emptyTitle="لا توجد بلاغات بعد" emptyText="ستظهر هنا البلاغات التي ترسلها من هذا الحساب." render={report => <article className="support-record" key={report.id}><i><FileWarning size={18}/></i><div><strong>{report.reason}</strong><p>{reportTargets.find(item => item.value === report.targetType)?.label || report.targetType} · {asRelativeTime(report.updatedAt || report.createdAt)}</p></div><span>{reportStatus(report.status)}</span></article>}/></div>}
  </main></AppShell>;
}

function SupportList<T extends { id: string }>({ data, isLoading, isError, refetch, title, emptyTitle, emptyText, render }: { data: T[] | undefined; isLoading: boolean; isError: boolean; refetch: () => unknown; title: string; emptyTitle: string; emptyText: string; render: (item: T) => React.ReactNode }) {
  return <Surface className="support-list-card"><div className="support-list-head"><div><h2>{title}</h2><p>{data ? `${data.length} سجل` : ""}</p></div>{isError && <button type="button" className="button ghost" onClick={() => { void refetch(); }}><RefreshCw size={16}/>إعادة المحاولة</button>}</div>{isLoading && <div className="support-state compact"><LoaderCircle className="animate-spin" size={24}/><p>يجري تحميل السجلات…</p></div>}{isError && <div className="support-state compact"><WifiOff size={24}/><h3>تعذر تحميل السجلات</h3><p>تحقق من الاتصال ثم أعد المحاولة.</p></div>}{!isLoading && !isError && !data?.length && <div className="support-state compact"><CheckCircle2 size={24}/><h3>{emptyTitle}</h3><p>{emptyText}</p></div>}{!isLoading && !isError && data?.map(render)}</Surface>;
}
