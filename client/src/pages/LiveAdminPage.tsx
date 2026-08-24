import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardList, FileWarning, LoaderCircle, RefreshCw, ShieldCheck, TicketCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, ApiError, asRelativeTime, type ApiAdminReport, type ApiAdminTicket, type ApiAdminUser } from "@/lib/api";
import "./live-admin.css";

type AdminView = "overview" | "users" | "tickets" | "reports";
type UserStatus = NonNullable<ApiAdminUser["status"]>;
type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const userStatuses: Array<{ value: UserStatus; label: string }> = [
  { value: "ACTIVE", label: "نشط" }, { value: "DISABLED", label: "معطل" },
  { value: "PENDING_VERIFICATION", label: "بانتظار التحقق" }, { value: "DELETED", label: "محذوف" },
];
const ticketStatuses: Array<{ value: TicketStatus; label: string }> = [
  { value: "OPEN", label: "مفتوح" }, { value: "IN_PROGRESS", label: "قيد المعالجة" },
  { value: "RESOLVED", label: "تم الحل" }, { value: "CLOSED", label: "مغلق" },
];
const reportStatuses: Array<{ value: ApiAdminReport["status"]; label: string }> = [
  { value: "OPEN", label: "مفتوح" }, { value: "REVIEWING", label: "قيد المراجعة" },
  { value: "RESOLVED", label: "تمت المعالجة" }, { value: "DISMISSED", label: "مغلق" },
];

function viewFor(path: string): AdminView {
  if (path === "/admin/users") return "users";
  if (path === "/admin/tickets") return "tickets";
  if (path === "/admin/reports") return "reports";
  return "overview";
}

function labelFor(value: string, entries: Array<{ value: string; label: string }>) {
  return entries.find((entry) => entry.value === value)?.label ?? value;
}

function AdminState({ icon: Icon, title, text, action }: { icon: typeof ShieldCheck; title: string; text: string; action?: React.ReactNode }) {
  return <Surface className="live-admin-state"><Icon size={31}/><h2>{title}</h2><p>{text}</p>{action}</Surface>;
}

function PersonLabel({ user }: { user?: { displayName?: string | null; username?: string | null } | null }) {
  if (!user) return <span className="live-admin-muted">لا توجد بيانات متاحة</span>;
  return <span><b>{user.displayName || user.username || "مستخدم"}</b>{user.username && <small>@{user.username}</small>}</span>;
}

export function LiveAdminPage() {
  const [location] = useLocation();
  const view = viewFor(location);
  const title = view === "users" ? "المستخدمون" : view === "tickets" ? "طلبات الدعم" : view === "reports" ? "بلاغات المحتوى" : "لوحة الإدارة";
  const { isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const access = useQuery({ queryKey: ["rest", "admin", "stats"], queryFn: api.getAdminStats, enabled: isAuthenticated, retry: false });
  const users = useQuery({ queryKey: ["rest", "admin", "users"], queryFn: api.getAdminUsers, enabled: access.isSuccess && view === "users", retry: false });
  const tickets = useQuery({ queryKey: ["rest", "admin", "tickets"], queryFn: api.getAdminTickets, enabled: access.isSuccess && (view === "tickets" || view === "overview"), retry: false });
  const reports = useQuery({ queryKey: ["rest", "admin", "reports"], queryFn: api.getAdminReports, enabled: access.isSuccess && (view === "reports" || view === "overview"), retry: false });
  const reload = async () => { await queryClient.invalidateQueries({ queryKey: ["rest", "admin"] }); };
  const userStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => api.updateAdminUserStatus(id, status),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["rest", "admin", "users"] }); toast.success("تم تحديث حالة المستخدم"); },
    onError: () => toast.error("تعذر تحديث حالة المستخدم"),
  });
  const ticketStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => api.updateAdminTicketStatus(id, status),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["rest", "admin", "tickets"] }); await queryClient.invalidateQueries({ queryKey: ["rest", "admin", "stats"] }); toast.success("تم تحديث حالة الطلب"); },
    onError: () => toast.error("تعذر تحديث حالة الطلب"),
  });
  const reportStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiAdminReport["status"] }) => api.updateAdminReportStatus(id, status),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["rest", "admin", "reports"] }); await queryClient.invalidateQueries({ queryKey: ["rest", "admin", "stats"] }); toast.success("تم تحديث حالة البلاغ"); },
    onError: () => toast.error("تعذر تحديث حالة البلاغ"),
  });

  if (isSessionLoading) return <AppShell title={title}><AdminState icon={LoaderCircle} title="يجري التحقق من الجلسة" text="لا تُطلب أو تُعرض أي بيانات إدارية قبل التحقق من الحساب والصلاحية."/></AppShell>;
  if (!isAuthenticated) return <AppShell title={title}><AdminState icon={ShieldCheck} title="تسجيل الدخول مطلوب" text="لوحة الإدارة مقيدة بحساب يحمل صلاحية المدير، ولا تعرض مؤشرات أو سجلات في الواجهة العامة." action={<Link className="button" href="/login">تسجيل الدخول</Link>}/></AppShell>;
  if (access.isLoading) return <AppShell title={title}><AdminState icon={LoaderCircle} title="يجري التحقق من الصلاحية" text="يتم التحقق من صلاحية المدير قبل تحميل أي بيانات تشغيلية."/></AppShell>;
  if (access.error) {
    const forbidden = access.error instanceof ApiError && access.error.status === 403;
    return <AppShell title={title}><AdminState icon={forbidden ? ShieldCheck : AlertTriangle} title={forbidden ? "لا تملك صلاحية الإدارة" : "تعذر فتح لوحة الإدارة"} text={forbidden ? "هذا الحساب لا يحمل دور المدير، لذلك لم يتم تحميل أي بيانات إدارية." : "تعذر التحقق من صلاحية الإدارة. تحقق من الاتصال ثم أعد المحاولة."} action={!forbidden ? <button className="button" onClick={() => void reload()}><RefreshCw size={16}/>إعادة المحاولة</button> : undefined}/></AppShell>;
  }

  const nav: Array<{ id: AdminView; href: string; label: string; icon: typeof BarChart3 }> = [
    { id: "overview", href: "/admin", label: "نظرة عامة", icon: BarChart3 }, { id: "users", href: "/admin/users", label: "المستخدمون", icon: UsersRound },
    { id: "tickets", href: "/admin/tickets", label: "طلبات الدعم", icon: TicketCheck }, { id: "reports", href: "/admin/reports", label: "البلاغات", icon: FileWarning },
  ];
  return <AppShell title={title}><main className="live-admin-page" dir="rtl">
    <header className="live-admin-header"><div><span>إدارة يمنا</span><h1>{title}</h1><p>{view === "overview" ? "مؤشرات وقوائم تشغيلية مصدرها البيانات الحية فقط." : "تحديث حالات السجلات متاح وفق صلاحية المدير والتحقق من الخادم."}</p></div><button className="button outline" onClick={() => void reload()}><RefreshCw size={16}/>تحديث</button></header>
    <nav className="live-admin-nav" aria-label="أقسام الإدارة">{nav.map((item) => { const Icon = item.icon; return <Link key={item.id} href={item.href} className={view === item.id ? "active" : ""}><Icon size={17}/>{item.label}</Link>; })}</nav>
    {view === "overview" && <AdminOverview stats={access.data!} tickets={tickets.data} reports={reports.data} ticketsLoading={tickets.isLoading} reportsLoading={reports.isLoading} ticketsError={tickets.isError} reportsError={reports.isError} onRetryTickets={() => void tickets.refetch()} onRetryReports={() => void reports.refetch()}/>}
    {view === "users" && <UserTable users={users.data} isLoading={users.isLoading} hasError={users.isError} onRetry={() => void users.refetch()} onChange={(id, status) => userStatus.mutate({ id, status })} isSaving={userStatus.isPending}/>}
    {view === "tickets" && <TicketTable tickets={tickets.data} isLoading={tickets.isLoading} hasError={tickets.isError} onRetry={() => void tickets.refetch()} onChange={(id, status) => ticketStatus.mutate({ id, status })} isSaving={ticketStatus.isPending}/>}
    {view === "reports" && <ReportTable reports={reports.data} isLoading={reports.isLoading} hasError={reports.isError} onRetry={() => void reports.refetch()} onChange={(id, status) => reportStatus.mutate({ id, status })} isSaving={reportStatus.isPending}/>}
  </main></AppShell>;
}

function AdminOverview({ stats, tickets, reports, ticketsLoading, reportsLoading, ticketsError, reportsError, onRetryTickets, onRetryReports }: { stats: { users: number; posts: number; communities: number; openTickets: number; openReports: number }; tickets?: ApiAdminTicket[]; reports?: ApiAdminReport[]; ticketsLoading: boolean; reportsLoading: boolean; ticketsError: boolean; reportsError: boolean; onRetryTickets: () => void; onRetryReports: () => void }) {
  const metrics = [["المستخدمون", stats.users, UsersRound], ["المنشورات", stats.posts, ClipboardList], ["المجتمعات", stats.communities, UsersRound], ["طلبات دعم مفتوحة", stats.openTickets, TicketCheck], ["بلاغات مفتوحة", stats.openReports, FileWarning]] as const;
  return <><section className="live-admin-metrics">{metrics.map(([label, value, Icon]) => <Surface key={label}><Icon size={19}/><small>{label}</small><b>{value.toLocaleString("ar-YE")}</b><span>بيانات حية</span></Surface>)}</section><section className="live-admin-split"><AdminPreview icon={TicketCheck} title="أحدث طلبات الدعم" href="/admin/tickets" loading={ticketsLoading} hasError={ticketsError} onRetry={onRetryTickets}>{tickets?.slice(0, 4).map((ticket) => <div key={ticket.id}><PersonLabel user={ticket.user}/><span>{labelFor(ticket.status, ticketStatuses)}</span></div>)}</AdminPreview><AdminPreview icon={FileWarning} title="أحدث البلاغات" href="/admin/reports" loading={reportsLoading} hasError={reportsError} onRetry={onRetryReports}>{reports?.slice(0, 4).map((report) => <div key={report.id}><b>{report.reason}</b><span>{labelFor(report.status, reportStatuses)}</span></div>)}</AdminPreview></section></>;
}

function AdminPreview({ icon: Icon, title, href, loading, hasError, onRetry, children }: { icon: typeof TicketCheck; title: string; href: string; loading: boolean; hasError: boolean; onRetry: () => void; children?: React.ReactNode }) {
  return <Surface className="live-admin-preview"><header><span><Icon size={18}/></span><b>{title}</b><Link href={href}>عرض الكل</Link></header>{loading ? <p className="live-admin-muted">جارٍ تحميل البيانات…</p> : hasError ? <AdminListError title={title} onRetry={onRetry}/> : children ? <div className="live-admin-preview-list">{children}</div> : <p className="live-admin-muted">لا توجد سجلات حية لعرضها الآن.</p>}</Surface>;
}

function UserTable({ users, isLoading, hasError, onRetry, onChange, isSaving }: { users?: ApiAdminUser[]; isLoading: boolean; hasError: boolean; onRetry: () => void; onChange: (id: string, status: UserStatus) => void; isSaving: boolean }) {
  return <DataSection icon={UsersRound} title="المستخدمون" loading={isLoading} hasError={hasError} onRetry={onRetry} empty="لا توجد حسابات متاحة في الاستجابة الحالية.">{users?.map((user) => <div className="live-admin-row" key={user.id}><PersonLabel user={user}/><small>{user.email ?? "لا يوجد بريد معروض"}</small><small>{user.lastLoginAt ? `آخر دخول ${asRelativeTime(user.lastLoginAt)}` : "لا توجد بيانات دخول"}</small><select aria-label={`حالة ${user.displayName || user.username || user.id}`} value={user.status || "ACTIVE"} disabled={isSaving} onChange={(event) => onChange(user.id, event.target.value as UserStatus)}>{userStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></div>)}</DataSection>;
}

function TicketTable({ tickets, isLoading, hasError, onRetry, onChange, isSaving }: { tickets?: ApiAdminTicket[]; isLoading: boolean; hasError: boolean; onRetry: () => void; onChange: (id: string, status: TicketStatus) => void; isSaving: boolean }) {
  return <DataSection icon={TicketCheck} title="طلبات الدعم" loading={isLoading} hasError={hasError} onRetry={onRetry} empty="لا توجد طلبات دعم في الاستجابة الحالية.">{tickets?.map((ticket) => <div className="live-admin-row" key={ticket.id}><div><b>{ticket.subject}</b><small>{ticket.category}</small></div><PersonLabel user={ticket.user}/><small>{asRelativeTime(ticket.createdAt)}</small><select aria-label={`حالة طلب ${ticket.subject}`} value={ticket.status} disabled={isSaving} onChange={(event) => onChange(ticket.id, event.target.value as TicketStatus)}>{ticketStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></div>)}</DataSection>;
}

function ReportTable({ reports, isLoading, hasError, onRetry, onChange, isSaving }: { reports?: ApiAdminReport[]; isLoading: boolean; hasError: boolean; onRetry: () => void; onChange: (id: string, status: ApiAdminReport["status"]) => void; isSaving: boolean }) {
  return <DataSection icon={FileWarning} title="بلاغات المحتوى" loading={isLoading} hasError={hasError} onRetry={onRetry} empty="لا توجد بلاغات في الاستجابة الحالية.">{reports?.map((report) => <div className="live-admin-row" key={report.id}><div><b>{report.reason}</b>{report.details && <small>{report.details}</small>}</div><PersonLabel user={report.reporter}/><small>{asRelativeTime(report.createdAt)}</small><select aria-label={`حالة البلاغ ${report.reason}`} value={report.status} disabled={isSaving} onChange={(event) => onChange(report.id, event.target.value as ApiAdminReport["status"])}>{reportStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></div>)}</DataSection>;
}

function AdminListError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return <div className="live-admin-list-error" role="alert"><AlertTriangle size={18}/><p>تعذر تحميل {title}. لم تُعرض قائمة فارغة بدلًا من بيانات الخادم.</p><button type="button" className="live-admin-retry" onClick={onRetry}><RefreshCw size={15}/>إعادة المحاولة</button></div>;
}

function DataSection({ icon: Icon, title, loading, hasError, onRetry, empty, children }: { icon: typeof UsersRound; title: string; loading: boolean; hasError: boolean; onRetry: () => void; empty: string; children?: React.ReactNode }) {
  return <Surface className="live-admin-table"><header><span><Icon size={19}/></span><div><h2>{title}</h2><p>بيانات مباشرة مقيدة بصلاحية المدير.</p></div></header>{loading ? <p className="live-admin-muted">جارٍ تحميل البيانات…</p> : hasError ? <AdminListError title={title} onRetry={onRetry}/> : children ? <div className="live-admin-list">{children}</div> : <p className="live-admin-muted">{empty}</p>}</Surface>;
}
