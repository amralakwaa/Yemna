import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Bell, ChevronLeft, FileText, LoaderCircle, Lock, Settings, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, asPerson, clearRestAccessToken, type ApiAuthSession, type ApiUserSettings } from "@/lib/api";
import { settingsGroups } from "@/lib/yemnaData";

type SettingsView = "overview" | "privacy" | "notifications" | "security" | "password" | "twoFactor" | "language" | "sessions" | "data" | "privacyCenter";

const settingsRoutes: Record<string, string | undefined> = {
  "معلومات شخصية": "/account/info",
  "كلمة المرور": "/settings/password",
  "الخصوصية": "/settings/privacy",
  "الإشعارات": "/settings/notifications",
  "اللغة والمنطقة": "/settings/language",
  "التحقق بخطوتين": "/settings/two-factor",
  "الجلسات والأجهزة": "/settings/sessions",
  "المحظورون": "/blocked",
  "تنزيل بياناتك": "/settings/data",
  "مركز الخصوصية": "/settings/privacy-center",
  "المساعدة والدعم": "/help",
  "الإبلاغ عن مشكلة": "/help/report",
};

const viewRoutes: Record<SettingsView, string> = {
  overview: "/settings",
  privacy: "/settings/privacy",
  notifications: "/settings/notifications",
  security: "/settings/security",
  password: "/settings/password",
  twoFactor: "/settings/two-factor",
  language: "/settings/language",
  sessions: "/settings/sessions",
  data: "/settings/data",
  privacyCenter: "/settings/privacy-center",
};

const viewMeta: Record<SettingsView, { title: string; description: string }> = {
  overview: { title: "الإعدادات", description: "اختر صفحة مستقلة لإدارة حسابك وخصوصيتك وأمانك." },
  privacy: { title: "الخصوصية", description: "تُحفظ هذه الخيارات وتُطبّق على طلبات الصداقة والمتابعة والمحادثات الجديدة." },
  notifications: { title: "تفضيلات الإشعارات", description: "اختر التنبيهات التي تريد استلامها. التغيير محفوظ ويؤثر في الإشعارات الجديدة فقط." },
  security: { title: "الأمان", description: "راجع كلمات المرور والتحقق الثنائي والأجهزة من صفحات مستقلة." },
  password: { title: "كلمة المرور", description: "غيّر كلمة المرور بأمان باستخدام كلمة المرور الحالية." },
  twoFactor: { title: "التحقق بخطوتين", description: "فعّل تطبيق مصادقة عبر رمز زمني متغير، ثم أكّد الرمز لحماية تسجيل الدخول." },
  language: { title: "اللغة والمنطقة", description: "احفظ تفضيلات لغة الواجهة والمنطقة في حسابك." },
  sessions: { title: "الجلسات والأجهزة", description: "راجع جلسات الدخول النشطة وأنهِ أي جلسة لا تتعرّف عليها." },
  data: { title: "تنزيل بياناتك", description: "صدّر نسخة مقيدة من بيانات حسابك الشخصية بصيغة JSON." },
  privacyCenter: { title: "مركز الخصوصية", description: "اطّلع على صفحات الخصوصية والبيانات المتاحة في حسابك." },
};

function SettingNotice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="settings-notice"><div>{icon}</div><h2>{title}</h2><p>{text}</p></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "وقت غير متاح" : date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function ToggleRow({ title, detail, checked, disabled, onChange }: { title: string; detail: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span><b>{title}</b><small>{detail}</small></span><input type="checkbox" role="switch" checked={checked} disabled={disabled} aria-label={title} onChange={event => onChange(event.target.checked)}/></label>;
}

function PrivacyRows({ settings, disabled, onSave }: { settings?: ApiUserSettings; disabled: boolean; onSave: (payload: Partial<ApiUserSettings>) => void }) {
  const labels = { EVERYONE: "الجميع", FRIENDS: "الأصدقاء فقط", NOBODY: "لا أحد" } as const;
  return <section className="settings-section" aria-label="خيارات الخصوصية">
    <label className="settings-select-row"><span><b>من يمكنه إرسال طلب صداقة؟</b><small>يتحقق النظام من هذا الخيار قبل إنشاء طلب جديد.</small></span><select value={settings?.friendRequestPermission ?? "EVERYONE"} disabled={disabled} onChange={event => onSave({ friendRequestPermission: event.target.value as ApiUserSettings["friendRequestPermission"] })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="settings-select-row"><span><b>من يمكنه متابعتك؟</b><small>يتحقق النظام من هذا الخيار قبل إنشاء متابعة جديدة.</small></span><select value={settings?.followPermission ?? "EVERYONE"} disabled={disabled} onChange={event => onSave({ followPermission: event.target.value as ApiUserSettings["followPermission"] })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <ToggleRow title="إظهار حالة الاتصال" detail="لا يزال هذا الخيار محفوظاً لحين استهلاكه في واجهات الحضور." checked={settings?.showOnlineStatus ?? true} disabled={disabled} onChange={showOnlineStatus => onSave({ showOnlineStatus })}/>
    <ToggleRow title="السماح بالرسائل المباشرة" detail="يمنع الحسابات الأخرى من بدء محادثة خاصة جديدة معك عند إيقافه، من دون تعطيل محادثاتك القائمة." checked={settings?.allowDirectMessages ?? true} disabled={disabled} onChange={allowDirectMessages => onSave({ allowDirectMessages })}/>
  </section>;
}

function NotificationRows({ settings, disabled, onSave }: { settings?: ApiUserSettings; disabled: boolean; onSave: (payload: Partial<ApiUserSettings>) => void }) {
  const choices: Array<{ key: keyof Pick<ApiUserSettings, "notifyMessages" | "notifyFriendRequests" | "notifyFollows" | "notifyPostActivity" | "notifyCalls" | "notifyCommunities">; title: string; detail: string }> = [
    { key: "notifyMessages", title: "الرسائل", detail: "رسائل خاصة جديدة من المحادثات التي تشارك فيها." },
    { key: "notifyFriendRequests", title: "طلبات الصداقة", detail: "طلبات الصداقة الجديدة وقبول الطلبات." },
    { key: "notifyFollows", title: "المتابعة", detail: "تنبيه عند متابعة حسابك." },
    { key: "notifyPostActivity", title: "المنشورات والتعليقات", detail: "تفاعلات وتعليقات وردود مرتبطة بمحتواك." },
    { key: "notifyCalls", title: "المكالمات", detail: "دعوات المكالمات الواردة." },
    { key: "notifyCommunities", title: "المجتمعات", detail: "التحديثات والإشعارات المرتبطة بالمجتمعات." },
  ];
  return <section className="settings-section" aria-label="تفضيلات الإشعارات"><p className="settings-lead">لا يمكن كتم رسائل النظام الضرورية الخاصة بأمان الحساب.</p>{choices.map(choice => <ToggleRow key={choice.key} title={choice.title} detail={choice.detail} checked={settings?.[choice.key] ?? true} disabled={disabled} onChange={value => onSave({ [choice.key]: value })}/>)}</section>;
}

function SessionsPanel({ sessions, isLoading, isError, onRetry, onRevoke, onRevokeOthers, pending }: { sessions?: ApiAuthSession[]; isLoading: boolean; isError: boolean; onRetry: () => void; onRevoke: (id: string) => void; onRevokeOthers: () => void; pending: boolean }) {
  if (isLoading) return <div className="settings-loading"><LoaderCircle className="animate-spin" size={23}/><span>يجري تحميل الجلسات النشطة…</span></div>;
  if (isError) return <section className="settings-section"><SettingNotice icon={<X size={29}/>} title="تعذر تحميل الجلسات" text="تحقق من الاتصال ثم أعد المحاولة."/><button className="button secondary" type="button" onClick={onRetry}>إعادة المحاولة</button></section>;
  const otherSessions = (sessions ?? []).filter(session => !session.isCurrent);
  return <section className="settings-section"><div className="sessions-toolbar"><span><b>الجلسات النشطة</b><small>لا نعرض عنوان IP حفاظاً على خصوصيتك.</small></span><button className="button secondary" type="button" disabled={pending || otherSessions.length === 0} onClick={onRevokeOthers}>إنهاء الجلسات الأخرى</button></div>{(sessions ?? []).length === 0 ? <SettingNotice icon={<ShieldCheck size={29}/>} title="لا توجد جلسات نشطة" text="أعد تحميل الصفحة للتحقق من جلسة الدخول الحالية."/> : <div className="session-list">{sessions?.map(session => <div key={session.id}><span><b>{session.deviceName}</b><small>{session.isCurrent ? "هذه الجلسة الحالية" : `آخر نشاط: ${formatDate(session.lastActiveAt)}`}</small></span>{session.isCurrent ? <em className="session-current">الحالية</em> : <button className="button secondary" type="button" disabled={pending} onClick={() => onRevoke(session.id)}>إنهاء</button>}</div>)}</div>}</section>;
}

function PasswordView() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const changePassword = useMutation({ mutationFn: () => api.changePassword(currentPassword, newPassword), onSuccess: () => { setCurrentPassword(""); setNewPassword(""); setConfirmation(""); toast.success("تم تغيير كلمة المرور وإنهاء الجلسات الأخرى"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "sessions"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر تغيير كلمة المرور") });
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (newPassword.length < 10) return toast.error("يجب أن تتكون كلمة المرور الجديدة من 10 أحرف على الأقل"); if (newPassword !== confirmation) return toast.error("تأكيد كلمة المرور غير مطابق"); changePassword.mutate(); };
  return <section className="settings-section"><h2>تغيير كلمة المرور</h2><p className="settings-lead">يتطلب هذا الإجراء كلمة المرور الحالية، ثم ينهي كل الجلسات الأخرى تلقائياً.</p><form className="security-password-form" onSubmit={submit}><label>كلمة المرور الحالية<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={changePassword.isPending}/></label><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={event => setNewPassword(event.target.value)} required disabled={changePassword.isPending}/></label><label>تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={10} value={confirmation} onChange={event => setConfirmation(event.target.value)} required disabled={changePassword.isPending}/></label><button className="button" type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}</button></form></section>;
}

function LanguageView({ settings, disabled, onSave }: { settings?: ApiUserSettings; disabled: boolean; onSave: (payload: Partial<ApiUserSettings>) => void }) {
  return <section className="settings-section"><h2>لغة الواجهة والمنطقة</h2><p className="settings-lead">تُحفظ هذه التفضيلات في حسابك، ويمكن للخدمات القادمة استخدامها لتنسيق التجربة والمحتوى المحلي.</p><label className="settings-select-row"><span><b>لغة الواجهة</b><small>تحديد لغة حسابك المفضلة.</small></span><select value={settings?.locale ?? "ar"} disabled={disabled} onChange={event => onSave({ locale: event.target.value as "ar" | "en" })}><option value="ar">العربية</option><option value="en">English</option></select></label><label className="settings-select-row"><span><b>المنطقة</b><small>رمز الدولة المكوّن من حرفين لتخصيص السياق المحلي.</small></span><select value={settings?.region ?? "YE"} disabled={disabled} onChange={event => onSave({ region: event.target.value })}><option value="YE">اليمن</option><option value="SA">المملكة العربية السعودية</option><option value="AE">الإمارات العربية المتحدة</option><option value="OM">عُمان</option><option value="QA">قطر</option><option value="KW">الكويت</option><option value="BH">البحرين</option><option value="EG">مصر</option><option value="JO">الأردن</option></select></label></section>;
}

function TwoFactorView() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; expiresAt: string } | null>(null);
  const status = useQuery({ queryKey: ["rest", "auth", "two-factor"], queryFn: api.getTwoFactorStatus, retry: 1 });
  const begin = useMutation({ mutationFn: () => api.setupTwoFactor(currentPassword), onSuccess: result => { setSetup(result); setCurrentPassword(""); setVerificationCode(""); toast.success("أضف المفتاح إلى تطبيق المصادقة ثم أكّد الرمز"); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر بدء الإعداد") });
  const confirm = useMutation({ mutationFn: () => api.confirmTwoFactor(verificationCode), onSuccess: () => { setSetup(null); setVerificationCode(""); toast.success("تم تفعيل التحقق بخطوتين"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "two-factor"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "رمز التحقق غير صحيح") });
  const disable = useMutation({ mutationFn: () => api.disableTwoFactor(currentPassword, verificationCode), onSuccess: () => { setCurrentPassword(""); setVerificationCode(""); toast.success("تم تعطيل التحقق بخطوتين"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "two-factor"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر تعطيل التحقق") });
  if (status.isLoading) return <div className="settings-loading"><LoaderCircle className="animate-spin" size={23}/><span>يجري تحميل حالة الحماية…</span></div>;
  if (status.isError) return <section className="settings-section"><SettingNotice icon={<X size={29}/>} title="تعذر تحميل حالة التحقق" text="تحقق من الاتصال ثم أعد المحاولة."/><button className="button secondary" type="button" onClick={() => void status.refetch()}>إعادة المحاولة</button></section>;
  const pending = begin.isPending || confirm.isPending || disable.isPending;
  if (status.data?.enabled) return <section className="settings-section"><SettingNotice icon={<ShieldCheck size={30}/>} title="التحقق بخطوتين مفعّل" text="سيُطلب رمز من تطبيق المصادقة عند تسجيل الدخول من جلسة جديدة."/><form className="security-password-form" onSubmit={event => { event.preventDefault(); if (!/^\d{6}$/.test(verificationCode)) return toast.error("أدخل رمزاً مكوّناً من 6 أرقام"); disable.mutate(); }}><label>كلمة المرور الحالية<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={pending}/></label><label>رمز تطبيق المصادقة<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ""))} required disabled={pending}/></label><button className="button secondary" type="submit" disabled={pending}>{disable.isPending ? "جارٍ التعطيل…" : "تعطيل التحقق بخطوتين"}</button></form></section>;
  if (setup) return <section className="settings-section"><h2>تأكيد التحقق بخطوتين</h2><p className="settings-lead">امسح الرابط في تطبيق مصادقة موثوق أو أضف المفتاح مرة واحدة، ثم أدخل الرمز المكوّن من 6 أرقام. ينتهي المفتاح المؤقت في {formatDate(setup.expiresAt)}.</p><label className="security-secret">رابط إعداد التطبيق<textarea readOnly value={setup.otpauthUrl} aria-label="رابط إعداد تطبيق المصادقة"/></label><form className="security-password-form" onSubmit={event => { event.preventDefault(); if (!/^\d{6}$/.test(verificationCode)) return toast.error("أدخل رمزاً مكوّناً من 6 أرقام"); confirm.mutate(); }}><label>رمز التحقق<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ""))} required disabled={pending}/></label><button className="button" type="submit" disabled={pending}>{confirm.isPending ? "جارٍ التفعيل…" : "تأكيد التفعيل"}</button></form></section>;
  return <section className="settings-section"><h2>فعّل التحقق بخطوتين</h2><p className="settings-lead">استخدم تطبيق مصادقة موثوقاً. يتطلب التشغيل كلمة المرور الحالية، ولا تُحفظ كلمات المرور أو رموز التطبيق في الواجهة.</p><form className="security-password-form" onSubmit={event => { event.preventDefault(); begin.mutate(); }}><label>كلمة المرور الحالية<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={pending}/></label><button className="button" type="submit" disabled={pending}>{begin.isPending ? "جارٍ إنشاء إعداد آمن…" : "إعداد التحقق بخطوتين"}</button></form></section>;
}

function DataExportView() {
  const download = useMutation({ mutationFn: api.getPersonalDataExport, onSuccess: payload => { const file = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = `yemna-data-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); toast.success("بدأ تنزيل بيانات حسابك"); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر تجهيز بيانات الحساب") });
  return <section className="settings-section"><h2>تنزيل بيانات حسابك</h2><p className="settings-lead">ينشئ هذا الزر ملف JSON خاصاً ببيانات حسابك وإعداداتك ومحتواك وإشعاراتك. لا يتضمن كلمات المرور أو رموز الجلسات أو أسرار التحقق الثنائي أو بيانات الآخرين الخاصة.</p><button className="button" type="button" disabled={download.isPending} onClick={() => download.mutate()}>{download.isPending ? "جارٍ تجهيز الملف…" : "تنزيل بياناتي"}</button></section>;
}

function SecurityOverview() {
  return <section className="settings-section settings-action-list"><p className="settings-lead">فُصلت إعدادات الأمان إلى صفحات مستقلة حتى تتمكن من مراجعة كل إجراء حساس بوضوح.</p><Link href="/settings/password"><span><b>كلمة المرور</b><small>غيّر كلمة المرور وأنهِ الجلسات الأخرى تلقائياً.</small></span><ChevronLeft size={18}/></Link><Link href="/settings/two-factor"><span><b>التحقق بخطوتين</b><small>تحقق من حالة الحماية الثنائية في صفحة مخصصة.</small></span><ChevronLeft size={18}/></Link><Link href="/settings/sessions"><span><b>الجلسات والأجهزة</b><small>راجع الأجهزة التي لا تزال مسجّلة الدخول.</small></span><ChevronLeft size={18}/></Link></section>;
}

function PrivacyCenterView() {
  return <section className="settings-section settings-action-list"><p className="settings-lead">اختر المجال الذي تريد مراجعته. كل خيار يفتح صفحته المستقلة.</p><Link href="/settings/privacy"><span><b>خيارات الخصوصية</b><small>طلبات الصداقة والمتابعة والرسائل المباشرة.</small></span><ChevronLeft size={18}/></Link><Link href="/settings/data"><span><b>بيانات الحساب</b><small>اعرف حالة توفر تصدير بياناتك.</small></span><ChevronLeft size={18}/></Link><Link href="/blocked"><span><b>الحسابات المحظورة</b><small>انتقل إلى قائمة المحظورين لإدارتها.</small></span><ChevronLeft size={18}/></Link></section>;
}

function Overview() {
  return <div className="settings-overview"><SettingNotice icon={<Settings size={30}/>} title="إعدادات حسابك" text="كل تبويب في القائمة يفتح الآن صفحة مستقلة بعنوان ومسار مباشر."/></div>;
}

function iconFor(item: string) {
  if (item === "الإشعارات") return <Bell size={18}/>;
  if (item === "الخصوصية" || item === "مركز الخصوصية") return <Lock size={18}/>;
  if (item === "تسجيل الخروج") return <X size={18}/>;
  return <ShieldCheck size={18}/>;
}

function SettingsPageShell({ view }: { view: SettingsView }) {
  const [, setLocation] = useLocation();
  const { currentUser, isAuthenticated, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const needsStoredSettings = view === "privacy" || view === "notifications" || view === "language";
  const needsSessions = view === "sessions";
  const settings = useQuery({ queryKey: ["rest", "users", "me", "settings"], queryFn: api.getSettings, enabled: isAuthenticated && needsStoredSettings, retry: 1 });
  const sessions = useQuery({ queryKey: ["rest", "auth", "sessions"], queryFn: api.getAuthSessions, enabled: isAuthenticated && needsSessions, retry: 1 });
  const updateSettings = useMutation({ mutationFn: (payload: Partial<ApiUserSettings>) => api.updateSettings(payload), onSuccess: updated => { queryClient.setQueryData(["rest", "users", "me", "settings"], updated); toast.success("تم حفظ الإعدادات"); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر حفظ الإعدادات") });
  const revokeSession = useMutation({ mutationFn: api.revokeAuthSession, onSuccess: () => { toast.success("تم إنهاء الجلسة"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "sessions"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر إنهاء الجلسة") });
  const revokeOthers = useMutation({ mutationFn: api.revokeOtherAuthSessions, onSuccess: ({ count }) => { toast.success(count ? `تم إنهاء ${count} جلسة أخرى` : "لا توجد جلسات أخرى نشطة"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "sessions"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر إنهاء الجلسات الأخرى") });
  const logout = useMutation({ mutationFn: api.logout, onSettled: () => { clearRestAccessToken(); setLocation("/login"); } });
  const meta = viewMeta[view];
  const content = () => {
    if (isLoading) return <div className="settings-loading"><LoaderCircle className="animate-spin" size={23}/><span>يجري التحقق من الجلسة…</span></div>;
    if (!isAuthenticated || !currentUser) return <SettingNotice icon={<Lock size={30}/>} title="سجّل الدخول لإدارة الإعدادات" text="تحتاج هذه الخيارات إلى جلسة حسابك حتى نتمكن من عرض البيانات وحفظها بأمان."/>;
    if (needsStoredSettings && settings.isLoading) return <div className="settings-loading"><LoaderCircle className="animate-spin" size={23}/><span>يجري تحميل الإعدادات…</span></div>;
    if (needsStoredSettings && settings.isError) return <section className="settings-section"><SettingNotice icon={<X size={30}/>} title="تعذر تحميل الإعدادات" text="تحقق من الاتصال ثم أعد المحاولة."/><button className="button secondary" type="button" onClick={() => void settings.refetch()}>إعادة المحاولة</button></section>;
    if (view === "privacy") return <PrivacyRows settings={settings.data} disabled={updateSettings.isPending} onSave={updateSettings.mutate}/>;
    if (view === "notifications") return <NotificationRows settings={settings.data} disabled={updateSettings.isPending} onSave={updateSettings.mutate}/>;
    if (view === "security") return <SecurityOverview/>;
    if (view === "password") return <PasswordView/>;
    if (view === "twoFactor") return <TwoFactorView/>;
    if (view === "language") return <LanguageView settings={settings.data} disabled={updateSettings.isPending} onSave={updateSettings.mutate}/>;
    if (view === "sessions") return <SessionsPanel sessions={sessions.data} isLoading={sessions.isLoading} isError={sessions.isError} onRetry={() => void sessions.refetch()} onRevoke={revokeSession.mutate} onRevokeOthers={revokeOthers.mutate} pending={revokeSession.isPending || revokeOthers.isPending}/>;
    if (view === "data") return <DataExportView/>;
    if (view === "privacyCenter") return <PrivacyCenterView/>;
    return <Overview/>;
  };
  return <AppShell title={meta.title}><div className="settings-page"><Surface className="settings-menu"><div className="settings-user">{currentUser ? <Avatar person={asPerson(currentUser)} size="lg"/> : <span className="settings-avatar-placeholder"><Lock size={18}/></span>}<span><b>{currentUser?.displayName ?? "حسابي"}</b><small>{isAuthenticated ? "إدارة حسابك" : "سجّل الدخول للمتابعة"}</small></span></div>{settingsGroups.map(group => <div className="settings-group" key={group.title}><small>{group.title}</small>{group.items.map(item => { const target = settingsRoutes[item]; if (item === "تسجيل الخروج") return <button type="button" key={item} disabled={logout.isPending} onClick={() => logout.mutate()}>{iconFor(item)} {logout.isPending ? "جارٍ تسجيل الخروج…" : item}</button>; if (!target) return null; return <Link key={item} href={target} className={target === viewRoutes[view] ? "active" : ""}>{iconFor(item)} {item}<ChevronLeft size={16}/></Link>; })}</div>)}</Surface><Surface className="settings-content"><nav className="settings-breadcrumb" aria-label="مسار الصفحة"><Link href="/settings">الإعدادات والخصوصية</Link><span>/</span><b>{meta.title}</b></nav><header><h1>{meta.title}</h1><p>{meta.description}</p></header>{content()}</Surface></div></AppShell>;
}

export function SettingsPage() { return <SettingsPageShell view="overview"/>; }
export function PrivacySettingsPage() { return <SettingsPageShell view="privacy"/>; }
export function NotificationSettingsPage() { return <SettingsPageShell view="notifications"/>; }
export function SecuritySettingsPage() { return <SettingsPageShell view="security"/>; }
export function PasswordSettingsPage() { return <SettingsPageShell view="password"/>; }
export function TwoFactorSettingsPage() { return <SettingsPageShell view="twoFactor"/>; }
export function LanguageSettingsPage() { return <SettingsPageShell view="language"/>; }
export function SessionsSettingsPage() { return <SettingsPageShell view="sessions"/>; }
export function DataSettingsPage() { return <SettingsPageShell view="data"/>; }
export function PrivacyCenterSettingsPage() { return <SettingsPageShell view="privacyCenter"/>; }
