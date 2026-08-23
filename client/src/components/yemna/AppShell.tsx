/** فلسفة يمنا: هيكل متجاوب RTL يوحّد سطح المكتب والهاتف دون تصغير قسري لواجهة سطح المكتب. */
import { useCallback, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import * as Icons from "lucide-react";
import { Bell, ChevronDown, Menu, MessageCircle, Moon, Plus, Search, SquarePen, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { navItems } from "@/lib/yemnaData";
import { api, asPerson, clearRestAccessToken } from "@/lib/api";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRealtimeSubscription } from "@/lib/realtime";
import { Avatar, SearchBox } from "./UI";
import { YemnaLogo } from "./YemnaLogo";

const sideItems = [
  ...navItems.slice(0, 4),
  navItems[5],
  navItems[4],
  navItems[6],
  navItems[7],
  { key: "support", label: "المساعدة والدعم", path: "/help", icon: "CircleHelp" },
  { key: "settings", label: "الإعدادات والخصوصية", path: "/settings", icon: "Settings" },
];

function NavIcon({ icon, size = 20 }: { icon: string; size?: number }) { const Component = Icons[icon as keyof typeof Icons] as React.ComponentType<{size?: number}>; return Component ? <Component size={size}/> : <Icons.Circle size={size}/>; }

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["rest", "notifications"], queryFn: api.getNotifications, enabled: Boolean(currentUser), staleTime: 15_000, refetchInterval: 30_000 });
  const conversationsQuery = useQuery({ queryKey: ["rest", "conversations"], queryFn: api.getConversations, enabled: Boolean(currentUser), staleTime: 15_000, refetchInterval: 30_000 });
  const refreshCounters = useCallback(() => { void queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }); void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] }); }, [queryClient]);
  useRealtimeSubscription(["message:new", "notification:new", "notification:read"], refreshCounters);
  const is = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const currentPerson = currentUser ? asPerson(currentUser) : null;
  const currentUserName = currentUser?.displayName || currentUser?.fullName || currentUser?.username || "حساب يمنا";
  const { theme, toggleTheme } = useTheme();
  const themeControl = <button className="theme-row" type="button" aria-pressed={theme === "dark"} onClick={toggleTheme}><Moon size={18}/><span>{theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}</span><span className={theme === "dark" ? "theme-switch is-on" : "theme-switch"}/></button>;
  const notifications = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const conversations = Array.isArray(conversationsQuery.data) ? conversationsQuery.data : [];
  const notificationCount = notifications.filter(notification => !notification.readAt).length;
  const messageCount = conversations.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0);
  const badgeFor = (key: string, fallback?: number) => key === "alerts" ? notificationCount : key === "messages" ? messageCount : fallback;
  const isGroupsDirectory = location === "/groups";
  const isMessagesPage = location === "/messages";
  const isSettingsPage = location === "/settings";
  const isGuestMediaCreatePage = location === "/create/media" && !isCurrentUserLoading && !currentUser;
  const isSettingsAuthPending = isSettingsPage && isCurrentUserLoading;
  const isGuestSettingsPage = isSettingsPage && !isCurrentUserLoading && !currentUser;
  const isRelationAccountPage = ["/friends", "/friend-requests", "/followers", "/following", "/people/discover", "/blocked", "/friend-suggestions", "/people/suggestions"].includes(location);
  const isGuestRelationPage = isRelationAccountPage && !isCurrentUserLoading && !currentUser;
  const pageContent = isGuestMediaCreatePage
    ? <div className="detail-narrow collection-page"><section className="content-placeholder"><Icons.Upload size={28}/><h3>سجّل الدخول لرفع الوسائط</h3><p>تحتاج إلى حسابك في يمنا لرفع الصور والفيديوهات إلى ألبوماتك.</p><Link className="button" href="/login">تسجيل الدخول</Link></section></div>
    : isSettingsAuthPending
    ? <div className="detail-narrow collection-page"><section className="content-placeholder"><Icons.LoaderCircle className="animate-spin" size={28}/><h3>جارٍ التحقق من جلسة الحساب</h3><p>لن تظهر إعدادات الحساب قبل التحقق من تسجيل الدخول.</p></section></div>
    : isGuestSettingsPage
    ? <div className="detail-narrow collection-page"><section className="content-placeholder"><Icons.Settings size={28}/><h3>سجّل الدخول لإدارة الإعدادات</h3><p>تحتاج إلى حسابك في يمنا لتعديل الخصوصية والأمان وتفضيلات الحساب.</p><Link className="button" href="/login">تسجيل الدخول</Link></section></div>
    : isGuestRelationPage
    ? <div className="detail-narrow collection-page"><section className="content-placeholder"><Icons.Users size={28}/><h3>سجّل الدخول لعرض {title || "علاقاتك"}</h3><p>تحتاج قوائم العلاقات والطلبات إلى حسابك في يمنا.</p><Link className="button" href="/login">تسجيل الدخول</Link></section></div>
    : children;
  const mobileProtectedAction = (href: string, label: string, icon: ReactNode, available = true) => {
    if (isCurrentUserLoading) return <button className="icon-button" type="button" disabled aria-label="جارٍ التحقق من جلسة الحساب">{icon}</button>;
    if (!currentUser) return <Link href="/login" className="icon-button" aria-label={`سجّل الدخول لـ${label}`}>{icon}</Link>;
    if (!available) return <button className="icon-button" type="button" disabled aria-label={`${label} غير متاح حتى اكتمال ربط مصدر البيانات`}>{icon}</button>;
    return <Link href={href} className="icon-button" aria-label={label}>{icon}</Link>;
  };
  const mobilePageAction = isGroupsDirectory
    ? mobileProtectedAction("/groups/create", "إنشاء مجموعة", <Plus/>, false)
    : isMessagesPage
      ? mobileProtectedAction("/messages/new", "رسالة جديدة", <SquarePen/>)
      : <><Link href="/search" className="icon-button" aria-label="البحث"><Search/></Link><Link href="/notifications" className="icon-button" aria-label="الإشعارات"><span className="relative"><Bell/>{notificationCount > 0 && <i className="nav-badge">{notificationCount}</i>}</span></Link></>;
  const handleLogout = async () => {
    try {
      await api.logout();
      clearRestAccessToken();
      setMobileMenuOpen(false);
      navigate("/login");
      toast.success("تم تسجيل الخروج بأمان");
    } catch {
      toast.error("تعذر إنهاء الجلسة من الخادم. تحقق من اتصالك ثم أعد المحاولة.");
    }
  };
  return <div className={currentUser ? "app-shell" : "app-shell app-shell--guest"}>
    <header className="desktop-header">
      <YemnaLogo compact/>
      <SearchBox />
      <nav className="top-nav" aria-label="التنقل الرئيسي">{navItems.map((item) => { const badge = badgeFor(item.key, item.badge); return <Link key={item.key} href={item.path} className={is(item.path) ? "top-nav-link active" : "top-nav-link"}><span className="relative"><NavIcon icon={item.icon} size={23}/>{Boolean(badge) && <i className="nav-badge">{badge}</i>}</span><small>{item.label}</small></Link>; })}</nav>
      {isCurrentUserLoading ? <div className="header-profile" aria-label="يجري تحميل الحساب"><span className="avatar avatar-md"/><strong>جارٍ تحميل الحساب…</strong></div> : currentPerson ? <Link href="/profile" className="header-profile" aria-label={`عرض الملف الشخصي لـ ${currentUserName}`}><Avatar person={currentPerson}/><strong>{currentUserName}</strong><ChevronDown size={16}/></Link> : <Link href="/login" className="header-profile" aria-label="تسجيل الدخول"><Icons.LogIn size={19}/><strong>تسجيل الدخول</strong></Link>}
    </header>
    <header className={title ? "mobile-header mobile-header-page" : "mobile-header"}><button className="icon-button" type="button" aria-label="فتح القائمة" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu/></button>{title ? <h1 className="mobile-context-title">{title}</h1> : <YemnaLogo compact/>}<div className="mobile-header-actions">{title ? mobilePageAction : <><Link href="/search" className="icon-button" aria-label="البحث"><Search/></Link><Link href="/notifications" className="icon-button" aria-label="الإشعارات"><span className="relative"><Bell/>{notificationCount > 0 && <i className="nav-badge">{notificationCount}</i>}</span></Link></>}</div></header>
    {mobileMenuOpen && <div className="mobile-menu-layer" role="dialog" aria-modal="true" aria-label="القائمة الرئيسية">
      <button className="mobile-menu-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}/>
      <aside className="mobile-menu-drawer">
        <div className="mobile-menu-head">{isCurrentUserLoading ? <div className="mobile-menu-profile" aria-label="يجري تحميل الحساب"><span className="avatar avatar-md"/><div><strong>جارٍ تحميل الحساب…</strong></div></div> : currentPerson ? <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-profile"><Avatar person={currentPerson}/><div><strong>{currentUserName}</strong><small>عرض الملف الشخصي</small></div></Link> : <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-profile"><Icons.LogIn size={20}/><div><strong>تسجيل الدخول</strong><small>ادخل إلى حسابك</small></div></Link>}<button className="icon-button" type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}><X/></button></div>
        <nav aria-label="روابط القائمة">{sideItems.map((item) => { const badge = badgeFor(item.key, item.badge); return <Link key={item.key} href={item.path} onClick={() => setMobileMenuOpen(false)} className={is(item.path) ? "mobile-menu-link active" : "mobile-menu-link"}><span className="relative"><NavIcon icon={item.icon}/>{Boolean(badge) && <i className="nav-badge">{badge}</i>}</span><span>{item.label}</span></Link>; })}</nav>
        <div className="mobile-menu-foot">{currentPerson ? <><Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-link"><Icons.UserRound size={20}/><span>الملف الشخصي</span></Link><button className="theme-row" type="button" onClick={handleLogout}><Icons.LogOut size={18}/> تسجيل الخروج</button></> : <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-link"><Icons.LogIn size={20}/><span>تسجيل الدخول</span></Link>}{themeControl}</div>
      </aside>
    </div>}
    <main className="desktop-layout">
      <aside className="sidebar-right"><div className="sidebar-account">{isCurrentUserLoading ? <div className="sidebar-account-loading"><span className="avatar avatar-md"/><span>جارٍ تحميل الحساب…</span></div> : currentPerson ? <Link href="/profile" className="sidebar-account-link" aria-label={`عرض الملف الشخصي لـ ${currentUserName}`}><Avatar person={currentPerson}/><span><strong>{currentUserName}</strong><small>@{currentUser?.username}</small></span></Link> : <Link href="/login" className="sidebar-account-link sidebar-account-login"><Icons.LogIn size={19}/><span><strong>تسجيل الدخول</strong><small>ادخل إلى حسابك</small></span></Link>}</div><nav>{sideItems.map((item) => { const badge = badgeFor(item.key, item.badge); return <Link key={item.key} href={item.path} className={is(item.path) ? "side-link active" : "side-link"}><span className="relative"><NavIcon icon={item.icon}/>{Boolean(badge) && <i className="nav-badge">{badge}</i>}</span><span>{item.label}</span></Link>; })}</nav><div className="sidebar-bottom">{currentPerson && <button className="theme-row" type="button" onClick={handleLogout}><Icons.LogOut size={18}/> تسجيل الخروج</button>}{themeControl}<small>© 2025 يمنا<br/>جميع الحقوق محفوظة</small></div></aside>
      <section className="page-stage">{title && <div className="mobile-page-title"><h1>{title}</h1></div>}{pageContent}</section>
    </main>
    <nav className="mobile-nav" aria-label="التنقل السفلي"><Link href="/" className={is("/") ? "active" : ""} aria-current={is("/") ? "page" : undefined}><Icons.House size={20}/><span>الرئيسية</span></Link><Link href="/friends" className={is("/friends") ? "active" : ""} aria-current={is("/friends") ? "page" : undefined}><Icons.Users size={20}/><span>الأصدقاء</span></Link><Link href="/create" className={is("/create") ? "create-nav active" : "create-nav"} aria-current={is("/create") ? "page" : undefined}><Plus size={25}/></Link><Link href="/notifications" className={is("/notifications") ? "active" : ""} aria-current={is("/notifications") ? "page" : undefined}><span className="relative"><Icons.Bell size={20}/>{notificationCount > 0 && <i className="nav-badge">{notificationCount}</i>}</span><span>الإشعارات</span></Link><button type="button" className="menu-trigger" aria-label="فتح القائمة" onClick={() => setMobileMenuOpen(true)}><Icons.Menu size={20}/><span>القائمة</span></button></nav>
  </div>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const currentPerson = currentUser ? asPerson(currentUser) : null;
  const currentUserName = currentUser?.displayName || currentUser?.fullName || currentUser?.username || "حساب يمنا";
  return <div className="admin-shell"><aside className="admin-side"><YemnaLogo compact/>{isCurrentUserLoading ? <div className="admin-person" aria-label="يجري تحميل الحساب"><span className="avatar avatar-md"/><strong>جارٍ تحميل الحساب…</strong><span>مدير النظام</span></div> : currentPerson ? <Link href="/profile" className="admin-person" aria-label={`عرض الملف الشخصي لـ ${currentUserName}`}><Avatar person={currentPerson}/><strong>{currentUserName}</strong><span>مدير النظام</span></Link> : <Link href="/login" className="admin-person" aria-label="تسجيل الدخول"><Icons.LogIn size={20}/><strong>تسجيل الدخول</strong></Link>}{[["LayoutDashboard","لوحة التحكم","/admin"],["Users","المستخدمون","/admin/users"],["FileText","إدارة المحتوى","/admin/content"],["ShieldAlert","مركز البلاغات","/admin/reports"],["BarChart3","التقارير والإحصائيات","/admin/analytics"],["Settings","إعدادات النظام","/admin/system"]].map(([icon,label,path])=><Link href={path} key={label} className="admin-link"><NavIcon icon={icon}/>{label}</Link>)}</aside><main className="admin-main"><header className="admin-header"><div><button className="icon-button"><Menu/></button><span>لوحة الإدارة</span></div><div><button className="icon-button"><Bell size={19}/></button>{isCurrentUserLoading ? <span className="avatar avatar-sm" aria-label="يجري تحميل الحساب"/> : currentPerson ? <Avatar person={currentPerson} size="sm"/> : <Link href="/login" className="icon-button" aria-label="تسجيل الدخول"><Icons.LogIn size={18}/></Link>}</div></header>{children}</main></div>;
}
