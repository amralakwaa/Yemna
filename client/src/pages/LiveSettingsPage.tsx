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

type SettingsView = "overview" | "privacy" | "notifications" | "security" | "sessions" | "data";

const settingsRoutes: Record<string, string | undefined> = {
  "المعلومات الشخصية": "/account/info",
  "كلمة المرور": "/settings/security",
  "الخصوصية": "/settings/privacy",
  "الإشعارات": "/settings/notifications",
  "المصادقة الثنائية": "/settings/security",
  "الجلسات والأجهزة": "/settings/sessions",
  "تنزيل بياناتك": "/settings/data",
};

const viewMeta: Record<SettingsView, { title: string; description: string }> = {
  overview: { title: "الإعدادات", description: "أدر خصوصية حسابك وأمانه والإشعارات من مكان واحد." },
  privacy: { title: "الخصوصية", description: "تُحفظ هذه الخيارات وتُطبّق على طلبات الصداقة والمتابعة والمحادثات الجديدة." },
  notifications: { title: "تفضيلات الإشعارات", description: "اختر التنبيهات التي تريد استلامها. التغيير محفوظ ويؤثر في الإشعارات الجديدة فقط." },
  security: { title: "الأمان وكلمة المرور", description: "غيّر كلمة المرور بأمان وراجع الأجهزة التي ما زالت مسجّلة الدخول." },
  sessions: { title: "الجلسات والأجهزة", description: "راجع جلسات الدخول النشطة وأنهِ أي جلسة لا تتعرّف عليها." },
  data: { title: "تنزيل بياناتك", description: "نعرض حالة توفر التصدير بوضوح قبل بدء أي عملية حساسة." },
};

function currentView(location: string): SettingsView {
  if (location === "/settings/privacy") return "privacy";
  if (location === "/settings/notifications") return "notifications";
  if (location === "/settings/security") return "security";
  if (location === "/settings/sessions") return "sessions";
  if (location === "/settings/data") return "data";
  return "overview";
}

function SettingNotice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="settings-notice"><div>{icon}</div><h2>{title}</h2><p>{text}</p></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "وقت غير متاح" : date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
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

function ToggleRow({ title, detail, checked, disabled, onChange }: { title: string; detail: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span><b>{title}</b><small>{detail}</small></span><input type="checkbox" role="switch" checked={checked} disabled={disabled} aria-label={title} onChange={event => onChange(event.target.checked)}/></label>;
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
  if (isError) return <SettingNotice icon={<X size={29}/>} title="تعذر تحميل الجلسات" text="تحقق من الاتصال ثم أعد المحاولة."/>;
  const otherSessions = (sessions ?? []).filter(session => !session.isCurrent);
  return <section className="settings-section"><div className="sessions-toolbar"><span><b>الجلسات النشطة</b><small>لا نعرض عنوان IP حفاظاً على خصوصيتك.</small></span><button className="button secondary" type="button" disabled={pending || otherSessions.length === 0} onClick={onRevokeOthers}>إنهاء الجلسات الأخرى</button></div>{(sessions ?? []).length === 0 ? <SettingNotice icon={<ShieldCheck size={29}/>} title="لا توجد جلسات نشطة" text="أعد تحميل الصفحة للتحقق من جلسة الدخول الحالية."/> : <div className="session-list">{sessions?.map(session => <div key={session.id}><span><b>{session.deviceName}</b><small>{session.isCurrent ? "هذه الجلسة الحالية" : `آخر نشاط: ${formatDate(session.lastActiveAt)}`}</small></span>{session.isCurrent ? <em className="session-current">الحالية</em> : <button className="button secondary" type="button" disabled={pending} onClick={() => onRevoke(session.id)}>إنهاء</button>}</div>)}</div>}{isError && <button className="button secondary" type="button" onClick={onRetry}>إعادة المحاولة</button>}</section>;
}

function SecurityView({ sessions, sessionsLoading, sessionsError, retrySessions, onRevoke, onRevokeOthers, sessionPending }: { sessions?: ApiAuthSession[]; sessionsLoading: boolean; sessionsError: boolean; retrySessions: () => void; onRevoke: (id: string) => void; onRevokeOthers: () => void; sessionPending: boolean }) {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const changePassword = useMutation({ mutationFn: () => api.changePassword(currentPassword, newPassword), onSuccess: () => { setCurrentPassword(""); setNewPassword(""); setConfirmation(""); toast.success("تم تغيير كلمة المرور وإنهاء الجلسات الأخرى"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "sessions"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر تغيير كلمة المرور") });
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (newPassword.length < 8) return toast.error("يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل"); if (newPassword !== confirmation) return toast.error("تأكيد كلمة المرور غير مطابق"); changePassword.mutate(); };
  return <><section className="settings-section"><h2>تغيير كلمة المرور</h2><p className="settings-lead">يتطلب هذا الإجراء كلمة المرور الحالية، ثم ينهي كل الجلسات الأخرى تلقائياً.</p><form className="security-password-form" onSubmit={submit}><label>كلمة المرور الحالية<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={changePassword.isPending}/></label><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required disabled={changePassword.isPending}/></label><label>تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} required disabled={changePassword.isPending}/></label><button className="button" type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}</button></form></section><section className="security-note"><ShieldCheck size={22}/><span><b>المصادقة الثنائية</b><small>ليست مفعلة حالياً. لن نعرض مفتاح تشغيل قبل توفير تحقق ثنائي فعلي وآمن.</small></span></section><SessionsPanel sessions={sessions} isLoading={sessionsLoading} isError={sessionsError} onRetry={retrySessions} onRevoke={onRevoke} onRevokeOthers={onRevokeOthers} pending={sessionPending}/></>;
}

function Overview() {
  return <div className="settings-overview"><SettingNotice icon={<Settings size={30}/>} title="إعدادات حسابك" text="انتقل من القائمة إلى الخصوصية، الإشعارات، أو الأمان لإدارة الخيارات المتاحة حالياً."/></div>;
}

export function SettingsPage() {
  const [location, setLocation] = useLocation();
  const view = currentView(location);
  const { currentUser, isAuthenticated, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["rest", "users", "me", "settings"], queryFn: api.getSettings, enabled: isAuthenticated, retry: 1 });
  const sessions = useQuery({ queryKey: ["rest", "auth", "sessions"], queryFn: api.getAuthSessions, enabled: isAuthenticated && (view === "security" || view === "sessions"), retry: 1 });
  const updateSettings = useMutation({ mutationFn: (payload: Partial<ApiUserSettings>) => api.updateSettings(payload), onSuccess: updated => { queryClient.setQueryData(["rest", "users", "me", "settings"], updated); toast.success("تم حفظ الإعدادات"); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر حفظ الإعدادات") });
  const revokeSession = useMutation({ mutationFn: api.revokeAuthSession, onSuccess: () => { toast.success("تم إنهاء الجلسة"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "sessions"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر إنهاء الجلسة") });
  const revokeOthers = useMutation({ mutationFn: api.revokeOtherAuthSessions, onSuccess: ({ count }) => { toast.success(count ? `تم إنهاء ${count} جلسة أخرى` : "لا توجد جلسات أخرى نشطة"); void queryClient.invalidateQueries({ queryKey: ["rest", "auth", "sessions"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "تعذر إنهاء الجلسات الأخرى") });
  const logout = useMutation({ mutationFn: api.logout, onSettled: () => { clearRestAccessToken(); setLocation("/login"); } });
  const meta = viewMeta[view];
  const openMenuItem = (item: string) => { if (item === "تسجيل الخروج") { logout.mutate(); return; } const route = settingsRoutes[item]; if (route) { setLocation(route); return; } toast.info("لا توجد خدمة حية لهذا الخيار بعد."); };
  const content = () => {
    if (isLoading) return <div className="settings-loading"><LoaderCircle className="animate-spin" size={23}/><span>يجري التحقق من الجلسة…</span></div>;
    if (!isAuthenticated || !currentUser) return <SettingNotice icon={<Lock size={30}/>} title="سجّل الدخول لإدارة الإعدادات" text="تحتاج هذه الخيارات إلى جلسة حسابك حتى نتمكن من عرض البيانات وحفظها بأمان."/>;
    if (view !== "data" && settings.isLoading) return <div className="settings-loading"><LoaderCircle className="animate-spin" size={23}/><span>يجري تحميل الإعدادات…</span></div>;
    if (view !== "data" && settings.isError) return <SettingNotice icon={<X size={30}/>} title="تعذر تحميل الإعدادات" text="تحقق من الاتصال ثم أعد المحاولة."/>;
    if (view === "privacy") return <PrivacyRows settings={settings.data} disabled={updateSettings.isPending} onSave={updateSettings.mutate}/>;
    if (view === "notifications") return <NotificationRows settings={settings.data} disabled={updateSettings.isPending} onSave={updateSettings.mutate}/>;
    if (view === "security") return <SecurityView sessions={sessions.data} sessionsLoading={sessions.isLoading} sessionsError={sessions.isError} retrySessions={() => void sessions.refetch()} onRevoke={revokeSession.mutate} onRevokeOthers={revokeOthers.mutate} sessionPending={revokeSession.isPending || revokeOthers.isPending}/>;
    if (view === "sessions") return <SessionsPanel sessions={sessions.data} isLoading={sessions.isLoading} isError={sessions.isError} onRetry={() => void sessions.refetch()} onRevoke={revokeSession.mutate} onRevokeOthers={revokeOthers.mutate} pending={revokeSession.isPending || revokeOthers.isPending}/>;
    if (view === "data") return <SettingNotice icon={<FileText size={30}/>} title="تصدير البيانات غير متاح بعد" text="لا يوجد حالياً عقد خلفي آمن لإنشاء ملف بيانات، لذا لن نعرض زر تنزيل يوحي بعملية غير موجودة."/>;
    return <Overview/>;
  };
  return <AppShell title="الإعدادات والخصوصية"><div className="settings-page"><Surface className="settings-menu"><div className="settings-user">{currentUser ? <Avatar person={asPerson(currentUser)} size="lg"/> : <span className="settings-avatar-placeholder"><Lock size={18}/></span>}<span><b>{currentUser?.displayName ?? "حسابي"}</b><small>{isAuthenticated ? "إدارة حسابك" : "سجّل الدخول للمتابعة"}</small></span></div>{settingsGroups.map(group => <div className="settings-group" key={group.title}><small>{group.title}</small>{group.items.map(item => { const target = settingsRoutes[item]; const active = (item === "الخصوصية" && view === "privacy") || (item === "الإشعارات" && view === "notifications") || ((item === "كلمة المرور" || item === "المصادقة الثنائية") && view === "security") || (item === "الجلسات والأجهزة" && view === "sessions") || (item === "تنزيل بياناتك" && view === "data"); return <button type="button" className={active ? "active" : ""} key={item} onClick={() => openMenuItem(item)}>{item === "الإشعارات" ? <Bell size={18}/> : item === "الخصوصية" ? <Lock size={18}/> : item === "تسجيل الخروج" ? <X size={18}/> : <ShieldCheck size={18}/>} {item}{target && <ChevronLeft size={16}/>}</button>; })}</div>)}</Surface><Surface className="settings-content"><header><h1>{meta.title}</h1><p>{meta.description}</p></header>{content()}</Surface></div></AppShell>;
}
