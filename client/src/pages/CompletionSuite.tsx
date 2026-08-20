/** فلسفة يمنا: إغلاق النواقص المتبقية بمسارات عربية مستقلة، عملية، وواضحة على الهاتف وسطح المكتب. */
import "../completion-suite.css";
import "../completion-polish.css";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, AdminShell } from "@/components/yemna/AppShell";
import { Avatar } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, ApiError, asPerson, hasRestSession } from "@/lib/api";
import { people } from "@/lib/yemnaData";
import { Activity, ArrowLeft, BarChart3, Bell, Bot, BrainCircuit, Check, ChevronLeft, CircleAlert, CircleHelp, Clock3, FileQuestion, Headphones, ImageUp, LifeBuoy, LockKeyhole, Mail, MessageCircle, Phone, Search, Send, ShieldAlert, ShieldCheck, Sparkles, Trash2, UserRound, UserRoundCheck, UserRoundCog, UserRoundX, UsersRound, Zap } from "lucide-react";

function SuiteHead({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return <header className="completion-head">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{text && <p>{text}</p>}</header>;
}

const supportEntries = [
  ["الأسئلة الشائعة", "إجابات موجزة عن الحساب والمحتوى والخصوصية.", "/help/faq", FileQuestion],
  ["الإبلاغ عن مشكلة", "أرسل بلاغاً لفريق الدعم مع تفاصيل واضحة.", "/help/report", CircleAlert],
  ["حالة البلاغ", "تابع آخر رد وتحديثات طلباتك المفتوحة.", "/help/report/status", Clock3],
  ["التواصل مع الدعم", "اختر القناة الأنسب للوصول إلى فريق يمنا.", "/help/contact", Headphones],
];

export function SupportSuitePage() {
  const [location] = useLocation();
  const mode = location.split("/").filter(Boolean).at(-1) || "help";
  const [category, setCategory] = useState<"ACCOUNT" | "TECHNICAL" | "SAFETY" | "OTHER">("TECHNICAL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const signedIn = hasRestSession();
  const queryClient = useQueryClient();
  const tickets = useQuery({ queryKey: ["rest", "support", "tickets"], queryFn: api.getSupportTickets, enabled: signedIn, retry: 1 });
  const createTicket = useMutation({
    mutationFn: api.createSupportTicket,
    onSuccess: () => { setSent(true); setSubject(""); setBody(""); void queryClient.invalidateQueries({ queryKey: ["rest", "support", "tickets"] }); },
    onError: error => toast.error(error instanceof ApiError ? error.message : "تعذر إرسال الطلب، حاول لاحقاً"),
  });
  const title = mode === "faq" ? "الأسئلة الشائعة" : mode === "report" ? "الإبلاغ عن مشكلة" : mode === "status" ? "حالة البلاغات" : mode === "contact" ? "التواصل مع الدعم" : "مركز المساعدة";
  const faq = [["كيف أستعيد حسابي؟", "من شاشة الدخول اختر «نسيت كلمة المرور»، ثم اتبع رمز التحقق المرسل إليك."],["كيف أتحكم بمن يرى منشوراتي؟", "من الإعدادات والخصوصية، افتح «الخصوصية» ثم اختر جمهور المنشورات."],["كيف أبلغ عن محتوى؟", "افتح خيارات المنشور ثم اختر «إبلاغ» وحدد سبباً مناسباً."],["أين أجد بياناتي؟", "من الحساب > بياناتك يمكنك طلب نسخة من المعلومات المتاحة."]];
  const submitTicket = (fallbackSubject = "طلب تواصل مع الدعم", fallbackBody = "يرغب المستخدم في التواصل مع فريق الدعم من داخل منصة يمنا.", nextCategory = category) => {
    if (!signedIn) return toast.error("سجّل الدخول أولاً لإرسال طلب الدعم");
    const nextSubject = subject.trim() || fallbackSubject;
    const nextBody = body.trim() || fallbackBody;
    if (nextSubject.length < 3 || nextBody.length < 10) return toast.error("أضف عنواناً ووصفاً أوضح للمشكلة");
    createTicket.mutate({ category: nextCategory, subject: nextSubject, body: nextBody });
  };
  return <AppShell title={title}><main className="completion-page support-suite">
    {mode === "help" && <><SuiteHead eyebrow="دعم يمنا" title="كيف يمكننا مساعدتك؟" text="مساحة هادئة لمساعدتك على البقاء قريباً من مجتمعك بأمان ووضوح."/><div className="support-search"><Search/><input aria-label="بحث في المساعدة" placeholder="ابحث في المساعدة"/></div><section className="support-grid">{supportEntries.map(([label, text, href, Icon])=>{const I=Icon as typeof CircleHelp;return <Link href={href as string} key={label as string}><i><I/></i><strong>{label as string}</strong><p>{text as string}</p><ChevronLeft/></Link>})}</section><div className="support-note"><LifeBuoy/><div><strong>هل حسابك في خطر؟</strong><p>ابدأ من إعدادات الأمان أو تواصل معنا فوراً عند ملاحظة نشاط غير مألوف.</p></div><Link href="/settings/security">مراجعة الأمان</Link></div></>}
    {mode === "faq" && <><SuiteHead eyebrow="مركز المساعدة" title="الأسئلة الشائعة" text="إجابات مباشرة لأكثر المواضيع تداولاً."/><section className="faq-list">{faq.map(([q,a], i)=><details key={q} open={i===0}><summary><span>{q}</span><ChevronLeft/></summary><p>{a}</p></details>)}</section><div className="plain-action">لم تجد إجابتك؟ <Link href="/help/report">أرسل بلاغاً</Link></div></>}
    {mode === "report" && <div className="completion-form"><SuiteHead eyebrow="دعم يمنا" title="أخبرنا بما حدث" text="اكتب التفاصيل التي تساعد فريق الدعم على فهم المشكلة دون مشاركة بيانات حساسة."/>{sent ? <div className="success-state"><Check/><h2>تم استلام طلبك</h2><p>ستظهر حالة الطلب وتحديثاته في قائمة الدعم داخل يمنا.</p><Link href="/help/report/status" className="crimson-button">عرض حالة الطلب</Link></div> : <><label>نوع المشكلة<select value={category} onChange={event => setCategory(event.target.value as typeof category)}><option value="ACCOUNT">الحساب وتسجيل الدخول</option><option value="TECHNICAL">مشكلة تقنية</option><option value="SAFETY">خصوصية وأمان</option><option value="OTHER">أخرى</option></select></label><label>عنوان مختصر<input value={subject} onChange={event => setSubject(event.target.value)} placeholder="مثال: لا تصلني الإشعارات"/></label><label>وصف المشكلة<textarea value={body} onChange={event => setBody(event.target.value)} placeholder="متى بدأت المشكلة؟ وما الذي حدث؟"/></label><button disabled={createTicket.isPending} className="crimson-button" onClick={()=>submitTicket()}><Send/> {createTicket.isPending ? "جارٍ الإرسال…" : "إرسال الطلب"}</button></>}</div>}
    {mode === "status" && <><SuiteHead eyebrow="دعم يمنا" title="حالة الطلبات" text="تابع الطلبات التي أرسلتها وردود فريق الدعم."/>{!signedIn ? <div className="empty-completion"><LockKeyhole/><h2>سجّل الدخول لعرض طلباتك</h2><Link href="/login" className="crimson-button">تسجيل الدخول</Link></div> : tickets.isLoading ? <div className="empty-completion"><Clock3 className="animate-spin"/><p>يجري تحميل الطلبات…</p></div> : tickets.isError ? <div className="empty-completion"><CircleAlert/><p>تعذر تحميل الطلبات حالياً.</p><button className="quiet-button" onClick={()=>tickets.refetch()}>إعادة المحاولة</button></div> : tickets.data?.length ? <section className="ticket-list">{tickets.data.map(ticket => <article key={ticket.id}><i className={ticket.status === "CLOSED" ? "ticket-done" : "ticket-open"}>{ticket.status === "CLOSED" ? <Check/> : <Clock3/>}</i><div><strong>{ticket.subject}</strong><p>{ticket.category === "TECHNICAL" ? "مشكلة تقنية" : ticket.category === "SAFETY" ? "خصوصية وأمان" : ticket.category === "ACCOUNT" ? "الحساب" : "طلب عام"} — {new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString("ar-YE")}</p></div><span>{ticket.status === "CLOSED" ? "مغلق" : "قيد المراجعة"}</span><ChevronLeft/></article>)}</section> : <div className="empty-completion"><FileQuestion/><h2>لا توجد طلبات بعد</h2><p>أرسل طلباً وسيظهر هنا مع آخر حالته.</p></div>}<Link href="/help/report" className="quiet-button">إرسال طلب جديد</Link></>}
    {mode === "contact" && <>{sent ? <div className="success-state"><Check/><h2>تم إرسال طلب التواصل</h2><p>أضفنا طلبك إلى صندوق الدعم، وستظهر التحديثات في صفحة حالة الطلبات.</p><Link href="/help/report/status" className="crimson-button">متابعة حالة الطلب</Link></div> : <><SuiteHead eyebrow="دعم يمنا" title="تواصل مع الدعم" text="اختر طريقة التواصل المناسبة حسب نوع استفسارك."/><section className="contact-cards"><button disabled={createTicket.isPending} onClick={()=>submitTicket("طلب تواصل مع الدعم", "يرغب المستخدم في التواصل مع فريق الدعم عبر القناة العامة.")}><Mail/><div><strong>رسالة إلى الدعم</strong><span>تُسجّل كطلب يمكن متابعته من داخل المنصة</span></div><ChevronLeft/></button><button disabled={createTicket.isPending} onClick={()=>submitTicket("طلب مساعدة عاجل", "طلب مساعدة يتعلق بسلامة الحساب أو خصوصيته.", "SAFETY")}><MessageCircle/><div><strong>مساعدة للحساب</strong><span>للحسابات والخصوصية والأمان</span></div><ChevronLeft/></button><Link href="/help/report"><ShieldAlert/><div><strong>مشكلة أمان عاجلة</strong><span>أرسل التفاصيل الآمنة من نموذج الدعم</span></div><ChevronLeft/></Link></section></>}</>}
  </main></AppShell>;
}

const accountLinks = [
  ["معلومات الحساب", "الاسم، اسم المستخدم، وتاريخ الانضمام.", "/account/info", UserRound],
  ["تعديل البيانات", "حدّث الاسم والتعريف والصورة العامة.", "/account/edit", UserRoundCog],
  ["البريد الإلكتروني", "غيّر بريد الاسترداد وتحقق منه.", "/account/contact/email", Mail],
  ["رقم الهاتف", "أضف رقم حماية أو بدّله.", "/account/contact/phone", Phone],
  ["استعادة الحساب", "راجع وسائل الاسترداد وخطة الطوارئ.", "/account/recovery", ShieldCheck],
];

export function AccountSuitePage() {
  const [location] = useLocation();
  const mode = location.split("/").filter(Boolean).slice(1).join("/") || "overview";
  const [saved, setSaved] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const signedIn = hasRestSession();
  const profile = useQuery({ queryKey: ["rest", "users", "me"], queryFn: api.getMe, enabled: signedIn, retry: 1 });
  const queryClient = useQueryClient();
  const { refreshUser, setCurrentUser } = useCurrentUser();
  const updateProfile = useMutation({
    mutationFn: api.updateMe,
    onSuccess: updatedUser => {
      setCurrentUser(updatedUser);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["rest", "users", "me"] });
      void refreshUser().catch(() => undefined);
      toast.success("تم حفظ بيانات الملف الشخصي");
    },
    onError: error => toast.error(error instanceof ApiError ? error.message : "تعذر حفظ البيانات، حاول لاحقاً"),
  });
  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signedIn) return toast.error("سجّل الدخول أولاً لتعديل بياناتك");
    const values = new FormData(event.currentTarget);
    setSaved(false);
    try {
      let avatarUrl = account?.avatarUrl;
      if (avatarFile) {
        setUploadingAvatar(true);
        avatarUrl = (await api.uploadMedia(avatarFile)).publicUrl;
      }
      updateProfile.mutate({ displayName: String(values.get("displayName") || ""), username: String(values.get("username") || ""), bio: String(values.get("bio") || ""), avatarUrl });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "تعذر رفع الصورة الرمزية، حاول لاحقاً");
    } finally {
      setUploadingAvatar(false);
    }
  };
  const account = profile.data;
  const accountAvatar = account ? { id: Number.parseInt(account.id, 10) || 0, name: account.displayName || account.fullName || "حساب يمنا", handle: `@${account.username || "yemna"}`, avatar: avatarPreview || account.avatarUrl || people[0].avatar, online: false } : people[0];
  const title = mode === "info" ? "معلومات الحساب" : mode === "edit" ? "تعديل البيانات" : mode === "contact/email" ? "تغيير البريد الإلكتروني" : mode === "contact/phone" ? "تغيير رقم الهاتف" : mode === "recovery" ? "استعادة الحساب" : mode === "disable" ? "تعطيل الحساب" : mode === "delete" ? "حذف الحساب" : "الحساب";
  return <AppShell title={title}><main className="completion-page account-suite">
    {mode === "overview" && <><SuiteHead eyebrow="مساحتك في يمنا" title="إدارة معلومات حسابك" text="اضبط بياناتك ووسائل استردادك حتى تبقى تجربتك داخل المجتمع واضحة وآمنة."/><section className="account-nav">{accountLinks.map(([label,text,href,Icon])=>{const I=Icon as typeof UserRound; return <Link href={href as string} key={label as string}><i><I/></i><div><strong>{label as string}</strong><p>{text as string}</p></div><ChevronLeft/></Link>})}</section><section className="account-danger"><div><UserRoundX/><div><strong>إيقاف أو حذف الحساب</strong><p>اختر التعطيل المؤقت أو الحذف النهائي وفق احتياجك.</p></div></div><div><Link href="/account/disable">تعطيل</Link><Link href="/account/delete">حذف الحساب</Link></div></section></>}
    {mode === "info" && <>{!signedIn ? <div className="empty-completion"><LockKeyhole/><h2>سجّل الدخول لعرض معلومات حسابك</h2><Link href="/login" className="crimson-button">تسجيل الدخول</Link></div> : profile.isLoading ? <div className="empty-completion"><Clock3 className="animate-spin"/><p>يجري تحميل بيانات الحساب…</p></div> : profile.isError ? <div className="empty-completion"><CircleAlert/><p>تعذر تحميل معلومات الحساب.</p><button className="quiet-button" onClick={()=>profile.refetch()}>إعادة المحاولة</button></div> : <><SuiteHead eyebrow="حسابك" title="معلومات الحساب" text="بيانات التعريف الأساسية المرتبطة بحساب يمنا."/><section className="account-profile-card"><Avatar person={accountAvatar} size="xl"/><div><h2>{account?.displayName || account?.fullName || "حساب يمنا"}</h2><p>@{account?.username || "—"}{account?.createdAt ? ` · عضو منذ ${new Date(account.createdAt).toLocaleDateString("ar-YE", { month: "long", year: "numeric" })}` : ""}</p><span><ShieldCheck/> {account?.status === "ACTIVE" ? "الحساب نشط" : "البيانات محمية داخل يمنا"}</span></div><Link href="/account/edit" className="quiet-button account-profile-edit"><UserRoundCog/> تعديل الملف الشخصي</Link></section><dl className="info-list"><div><dt>البريد الإلكتروني</dt><dd>{account?.email || "غير مضاف"}</dd></div><div><dt>رقم الهاتف</dt><dd>{account?.phone || "غير مضاف"}</dd></div><div><dt>اللغة</dt><dd>العربية</dd></div><div><dt>المنطقة</dt><dd>{[account?.city, account?.governorate].filter(Boolean).join("، ") || "غير محددة"}</dd></div></dl></>}</>}
    {mode === "edit" && <form className="completion-form" onSubmit={submitProfile}><SuiteHead eyebrow="ملفك" title="تعديل الملف الشخصي" text="حدّث نبذتك وصورتك بالطريقة التي تود أن يعرفك بها مجتمع يمنا."/>{!signedIn ? <div className="empty-completion"><LockKeyhole/><h2>سجّل الدخول لتعديل ملفك</h2><Link href="/login" className="crimson-button">تسجيل الدخول</Link></div> : profile.isLoading ? <div className="empty-completion"><Clock3 className="animate-spin"/><p>يجري تحميل بيانات الملف…</p></div> : <><div className="avatar-edit-field"><Avatar person={accountAvatar} size="xl"/><label>الصورة الرمزية<span>اختر صورة واضحة من جهازك؛ تُحفظ مع ملفك العام.</span><input aria-label="اختيار صورة رمزية" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0] || null; setAvatarFile(file); setAvatarPreview(file ? URL.createObjectURL(file) : ""); }}/></label><ImageUp/></div><label>الاسم<input name="displayName" required minLength={2} defaultValue={account?.displayName || account?.fullName || ""}/></label><label>اسم المستخدم<input name="username" required minLength={3} defaultValue={account?.username || ""}/></label><label>نبذة<textarea name="bio" maxLength={500} defaultValue={account?.bio || ""} placeholder="عرّف مجتمع يمنا بك باختصار"/></label><button disabled={updateProfile.isPending || uploadingAvatar} className="crimson-button" type="submit">{uploadingAvatar ? "جارٍ رفع الصورة…" : updateProfile.isPending ? "جارٍ الحفظ…" : saved ? <><Check/> تم الحفظ</> : "حفظ التغييرات"}</button></>}</form>}
    {(mode === "contact/email" || mode === "contact/phone") && <div className="completion-form"><SuiteHead eyebrow="حماية الحساب" title={mode === "contact/email" ? "تغيير البريد الإلكتروني" : "تغيير رقم الهاتف"} text="سنطلب رمز تحقق قبل تطبيق التغيير."/><label>{mode === "contact/email" ? "البريد الجديد" : "رقم الهاتف الجديد"}<input placeholder={mode === "contact/email" ? "name@example.com" : "+967 7X XXX XXXX"}/></label><label>كلمة المرور الحالية<input type="password" placeholder="••••••••"/></label><button onClick={()=>setSaved(true)} className="crimson-button">{saved ? <><Check/> أرسلنا رمز التحقق</> : "إرسال رمز التحقق"}</button></div>}
    {mode === "recovery" && <><SuiteHead eyebrow="حماية الحساب" title="استعادة الحساب" text="حدد كيف تستعيد الوصول إذا فقدت كلمة المرور أو جهازك."/><section className="recovery-list"><article><Mail/><div><strong>البريد الإلكتروني</strong><p>omar@example.com</p></div><span>مفعّل</span></article><article><Phone/><div><strong>رقم الهاتف</strong><p>ينتهي بـ 4567</p></div><span>مفعّل</span></article><article><LockKeyhole/><div><strong>رموز الاسترداد</strong><p>احتفظ بها في مكان آمن خارج هاتفك.</p></div><button onClick={()=>setSaved(true)} className="quiet-button">{saved ? "تم إنشاء الرموز" : "إنشاء رموز"}</button></article></section></>}
    {mode === "disable" && <div className="decision-card"><UserRoundX/><SuiteHead eyebrow="إجراء قابل للعكس" title="تعطيل الحساب مؤقتاً" text="لن يظهر ملفك أو محتواك للآخرين حتى تسجل الدخول وتعيد التفعيل."/><label>سبب التعطيل<select defaultValue="استراحة"><option>استراحة مؤقتة</option><option>الخصوصية</option><option>سبب آخر</option></select></label><button onClick={()=>setSaved(true)} className="quiet-button">{saved ? "تم إرسال تأكيد التعطيل" : "تعطيل الحساب"}</button></div>}
    {mode === "delete" && <div className="decision-card destructive"><Trash2/><SuiteHead eyebrow="إجراء نهائي" title="حذف الحساب" text="سيبدأ حذف حسابك بعد فترة الحماية. يمكنك تنزيل بياناتك قبل المتابعة."/><label>اكتب «حذف حسابي» للتأكيد<input placeholder="حذف حسابي"/></label><button onClick={()=>setSaved(true)} className="danger-button">{saved ? "تم إرسال طلب الحذف" : "متابعة الحذف"}</button></div>}
  </main></AppShell>;
}

const mutualPeople = [people[1], people[2], people[3]].filter(Boolean);
export function RelationsCompletionPage() {
  const [location] = useLocation();
  const mode = location.includes("manage") ? "manage" : location.includes("unblock") ? "unblock" : location.includes("blocked") ? "blocked" : "mutual";
  const [blocked, setBlocked] = useState(mode === "blocked" || mode === "unblock");
  const [following, setFollowing] = useState(false);
  const [removed, setRemoved] = useState(false);
  const signedIn = hasRestSession();
  const { currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const currentPerson = currentUser ? asPerson(currentUser) : null;
  const queryClient = useQueryClient();
  const blocks = useQuery({ queryKey: ["rest", "relationships", "blocked"], queryFn: api.getBlocked, enabled: signedIn && (mode === "blocked" || mode === "unblock"), retry: 1 });
  const unblock = useMutation({
    mutationFn: api.unblockUser,
    onSuccess: () => { setBlocked(false); void queryClient.invalidateQueries({ queryKey: ["rest", "relationships", "blocked"] }); toast.success("تم إلغاء الحظر"); },
    onError: error => toast.error(error instanceof ApiError ? error.message : "تعذر إلغاء الحظر، حاول لاحقاً"),
  });
  return <AppShell title={mode === "mutual" ? "الأصدقاء المشتركون" : "إدارة العلاقة"}><main className="completion-page relations-completion">
    {mode === "mutual" && (!signedIn ? <div className="empty-completion"><LockKeyhole/><h2>سجّل الدخول لعرض الأصدقاء المشتركين</h2><Link href="/login" className="crimson-button">تسجيل الدخول</Link></div> : isCurrentUserLoading ? <div className="empty-completion"><Clock3 className="animate-spin"/><p>يجري تحميل حسابك…</p></div> : !currentPerson ? <div className="empty-completion"><CircleAlert/><p>تعذر تحميل حسابك لعرض العلاقات المشتركة.</p></div> : <><SuiteHead eyebrow="علاقاتك" title="أصدقاء مشتركون" text="أشخاص تعرفهم أنت ومحمد الحاج، وقد يساعدونكما على بدء تواصل جديد."/><section className="mutual-hero"><Avatar person={currentPerson} size="lg"/><div className="mutual-people">{mutualPeople.map(person=><Avatar key={person.id} person={person} size="md"/>)}</div><strong>3 أصدقاء مشتركون</strong></section><section className="people-list">{mutualPeople.map((person, i)=><article key={person.id}><Avatar person={person} size="lg"/><div><strong>{person.name}</strong><p>{i + 2} أصدقاء مشتركون · {i === 0 ? "يعمل في التعليم" : "يهتم بالمجتمعات"}</p></div><Link href="/profile" className="quiet-button">عرض الملف</Link></article>)}</section></>)}
    {mode === "manage" && <><SuiteHead eyebrow="علاقاتك" title="إدارة العلاقة" text="اختر ما يناسب طريقة ظهور تفاعلات هذا الشخص وحالتها."/><section className="relationship-card"><Avatar person={people[1]} size="xl"/><h2>{people[1]?.name}</h2><p>{removed ? "لم تعد هذه العلاقة ضمن قائمة الأصدقاء" : "صديق منذ أغسطس 2024"}</p><div className="relationship-actions"><button onClick={()=>setFollowing(!following)}><Bell/> {following ? "تتم متابعة الإشعارات" : "متابعة الإشعارات"}</button><Link href="/friends/mutual"><UsersRound/> عرض الأصدقاء المشتركين</Link><button onClick={()=>setRemoved(true)} className="warn"><UserRoundX/> {removed ? "تمت الإزالة" : "إزالة من الأصدقاء"}</button><button onClick={()=>setBlocked(true)} className="danger-lite"><ShieldAlert/> حظر الحساب</button></div></section></>}
    {(mode === "blocked" || mode === "unblock") && <><SuiteHead eyebrow="سلامتك" title="الحسابات المحظورة" text="لن يتمكن هؤلاء الأشخاص من رؤية ملفك أو مراسلتك."/>{!signedIn ? <div className="empty-completion"><LockKeyhole/><h2>سجّل الدخول لعرض الحظر</h2><Link href="/login" className="crimson-button">تسجيل الدخول</Link></div> : blocks.isLoading ? <div className="empty-completion"><Clock3 className="animate-spin"/><p>يجري تحميل الحسابات المحظورة…</p></div> : blocks.isError ? <div className="empty-completion"><CircleAlert/><p>تعذر تحميل قائمة الحظر.</p><button className="quiet-button" onClick={()=>blocks.refetch()}>إعادة المحاولة</button></div> : blocks.data?.length ? <section className="ticket-list">{blocks.data.map(block => <article className="blocked-card" key={block.id}><Avatar person={asPerson(block.blocked)} size="lg"/><div><strong>{block.blocked.displayName}</strong><p>{block.createdAt ? `تم الحظر في ${new Date(block.createdAt).toLocaleDateString("ar-YE")}` : "حساب محظور"}</p></div><button disabled={unblock.isPending} onClick={()=>unblock.mutate(block.blocked.id)} className="quiet-button">{unblock.isPending ? "جارٍ الإلغاء…" : "إلغاء الحظر"}</button></article>)}</section> : <div className="empty-completion"><ShieldCheck/><h2>لا توجد حسابات محظورة</h2><p>ستظهر هنا الحسابات التي تمنعها من التفاعل معك.</p></div>}</>}
  </main></AppShell>;
}

const insightCards = [["8,426", "طلباً إلى أدوات الذكاء", Activity, "+18% مقارنة بالأسبوع الماضي"],["71%", "نتائج تم اعتمادها", Check, "بعد مراجعة المستخدم"],["2.4 ث", "متوسط زمن الاستجابة", Zap, "ضمن المستوى المستهدف"],["93%", "استخدام آمن", ShieldCheck, "لا يحتاج إلى تدخل"]];
export function AIUsageAnalyticsPage() {
  return <AdminShell><main className="ai-usage-page"><SuiteHead eyebrow="إدارة يمنا · الذكاء الاصطناعي" title="تحليلات استخدام الذكاء الاصطناعي" text="راقب استخدام الأدوات وجودة النتائج وإشارات السلامة دون عرض محتوى المستخدمين الخاص."/><section className="insight-grid">{insightCards.map(([value,label,Icon,note])=>{const I=Icon as typeof Activity;return <article key={label as string}><i><I/></i><strong>{value as string}</strong><span>{label as string}</span><small>{note as string}</small></article>})}</section><section className="ai-chart-grid"><article className="chart-card"><header><div><span>الاستخدام خلال 7 أيام</span><strong>طلبات الأدوات</strong></div><BarChart3/></header><div className="bar-chart">{[38,58,45,72,61,84,68].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><small>{["س","ح","ن","ث","ر","خ","ج"][i]}</small></div>)}</div></article><article className="tool-ranking"><header><div><span>أكثر الأدوات استخداماً</span><strong>حسب عدد الطلبات</strong></div><BrainCircuit/></header>{[["مساعد الكتابة", "2,610", 92],["تلخيص المحتوى", "1,884", 68],["البحث الذكي", "1,327", 49],["اقتراحات الأصدقاء", "986", 36]].map(([name,total,width])=><div className="tool-row" key={name as string}><span>{name as string}</span><b>{total as string}</b><i><em style={{width:`${width}%`}}/></i></div>)}</article></section><section className="ai-safety-panel"><Bot/><div><strong>مراقبة الجودة والسلامة</strong><p>تمت مراجعة 127 إشارة تلقائياً هذا الأسبوع، مع تحويل 4 منها إلى فريق الإشراف.</p></div><Link href="/admin/reports" className="quiet-button">فتح البلاغات <ArrowLeft/></Link></section></main></AdminShell>;
}
