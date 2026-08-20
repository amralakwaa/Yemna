/** فلسفة يمنا: هيكل متجاوب RTL يوحّد سطح المكتب والهاتف دون تصغير قسري لواجهة سطح المكتب. */
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import * as Icons from "lucide-react";
import { Bell, ChevronDown, Menu, MessageCircle, Moon, Plus, Search, X } from "lucide-react";
import { navItems } from "@/lib/yemnaData";
import { asPerson } from "@/lib/api";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { Avatar, SearchBox } from "./UI";
import { YemnaLogo } from "./YemnaLogo";

const sideItems = [
  ...navItems.slice(0, 4),
  { key: "pages", label: "الصفحات", path: "/pages", icon: "Flag" },
  { key: "events", label: "الفعاليات", path: "/events", icon: "CalendarDays" },
  navItems[5],
  { key: "saved", label: "المحفوظات", path: "/saved", icon: "Bookmark" },
  navItems[4],
  { key: "discover", label: "استكشاف", path: "/search", icon: "Compass" },
  { key: "settings", label: "الإعدادات والخصوصية", path: "/settings", icon: "Settings" },
];

function NavIcon({ icon, size = 20 }: { icon: string; size?: number }) { const Component = Icons[icon as keyof typeof Icons] as React.ComponentType<{size?: number}>; return Component ? <Component size={size}/> : <Icons.Circle size={size}/>; }

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const is = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const currentPerson = currentUser ? asPerson(currentUser) : null;
  const currentUserName = currentUser?.displayName || currentUser?.fullName || currentUser?.username || "حساب يمنا";
  return <div className="app-shell">
    <header className="desktop-header">
      <YemnaLogo compact/>
      <SearchBox />
      <nav className="top-nav" aria-label="التنقل الرئيسي">{navItems.map((item) => <Link key={item.key} href={item.path} className={is(item.path) ? "top-nav-link active" : "top-nav-link"}><span className="relative"><NavIcon icon={item.icon} size={23}/>{item.badge && <i className="nav-badge">{item.badge}</i>}</span><small>{item.label}</small></Link>)}</nav>
      {isCurrentUserLoading ? <div className="header-profile" aria-label="يجري تحميل الحساب"><span className="avatar avatar-md"/><strong>جارٍ تحميل الحساب…</strong></div> : currentPerson ? <Link href="/profile" className="header-profile" aria-label={`عرض الملف الشخصي لـ ${currentUserName}`}><Avatar person={currentPerson}/><strong>{currentUserName}</strong><ChevronDown size={16}/></Link> : <Link href="/login" className="header-profile" aria-label="تسجيل الدخول"><Icons.LogIn size={19}/><strong>تسجيل الدخول</strong></Link>}
    </header>
    <header className="mobile-header"><button className="icon-button" type="button" aria-label="فتح القائمة" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu/></button><YemnaLogo compact/><div><Link href="/search" className="icon-button"><Search/></Link><Link href="/notifications" className="icon-button"><Bell/></Link></div></header>
    {mobileMenuOpen && <div className="mobile-menu-layer" role="dialog" aria-modal="true" aria-label="القائمة الرئيسية">
      <button className="mobile-menu-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}/>
      <aside className="mobile-menu-drawer">
        <div className="mobile-menu-head">{isCurrentUserLoading ? <div className="mobile-menu-profile" aria-label="يجري تحميل الحساب"><span className="avatar avatar-md"/><div><strong>جارٍ تحميل الحساب…</strong></div></div> : currentPerson ? <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-profile"><Avatar person={currentPerson}/><div><strong>{currentUserName}</strong><small>عرض الملف الشخصي</small></div></Link> : <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-profile"><Icons.LogIn size={20}/><div><strong>تسجيل الدخول</strong><small>ادخل إلى حسابك</small></div></Link>}<button className="icon-button" type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}><X/></button></div>
        <nav aria-label="روابط القائمة">{sideItems.map((item) => <Link key={item.key} href={item.path} onClick={() => setMobileMenuOpen(false)} className={is(item.path) ? "mobile-menu-link active" : "mobile-menu-link"}><span className="relative"><NavIcon icon={item.icon}/>{item.badge && <i className="nav-badge">{item.badge}</i>}</span><span>{item.label}</span></Link>)}</nav>
        <div className="mobile-menu-foot"><Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="mobile-menu-link"><Icons.UserRound size={20}/><span>الملف الشخصي</span></Link><button className="theme-row" type="button"><Moon size={18}/> الوضع الداكن <span className="fake-switch"/></button></div>
      </aside>
    </div>}
    <main className="desktop-layout">
      <aside className="sidebar-right"><nav>{sideItems.map((item) => <Link key={item.key} href={item.path} className={is(item.path) ? "side-link active" : "side-link"}><span className="relative"><NavIcon icon={item.icon}/>{item.badge && <i className="nav-badge">{item.badge}</i>}</span><span>{item.label}</span></Link>)}</nav><div className="sidebar-bottom"><button className="theme-row"><Moon size={18}/> الوضع الداكن <span className="fake-switch"/></button><small>© 2025 يمنا<br/>جميع الحقوق محفوظة</small></div></aside>
      <section className="page-stage">{title && <div className="mobile-page-title"><h1>{title}</h1></div>}{children}</section>
    </main>
    <nav className="mobile-nav" aria-label="التنقل السفلي"><Link href="/" className={is("/") ? "active" : ""}><Icons.House size={20}/><span>الرئيسية</span></Link><Link href="/friends"><Icons.Users size={20}/><span>الأصدقاء</span></Link><Link href="/create" className="create-nav"><Plus size={25}/></Link><Link href="/notifications"><span className="relative"><Icons.Bell size={20}/><i className="nav-badge">3</i></span><span>الإشعارات</span></Link><button type="button" className="menu-trigger" aria-label="فتح القائمة" onClick={() => setMobileMenuOpen(true)}><Icons.Menu size={20}/><span>القائمة</span></button></nav>
  </div>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const currentPerson = currentUser ? asPerson(currentUser) : null;
  const currentUserName = currentUser?.displayName || currentUser?.fullName || currentUser?.username || "حساب يمنا";
  return <div className="admin-shell"><aside className="admin-side"><YemnaLogo compact/>{isCurrentUserLoading ? <div className="admin-person" aria-label="يجري تحميل الحساب"><span className="avatar avatar-md"/><strong>جارٍ تحميل الحساب…</strong><span>مدير النظام</span></div> : currentPerson ? <Link href="/profile" className="admin-person" aria-label={`عرض الملف الشخصي لـ ${currentUserName}`}><Avatar person={currentPerson}/><strong>{currentUserName}</strong><span>مدير النظام</span></Link> : <Link href="/login" className="admin-person" aria-label="تسجيل الدخول"><Icons.LogIn size={20}/><strong>تسجيل الدخول</strong></Link>}{[["LayoutDashboard","لوحة التحكم","/admin"],["Users","المستخدمون","/admin/users"],["FileText","إدارة المحتوى","/admin/content"],["ShieldAlert","مركز البلاغات","/admin/reports"],["BarChart3","التقارير والإحصائيات","/admin/analytics"],["Settings","إعدادات النظام","/admin/system"]].map(([icon,label,path])=><Link href={path} key={label} className="admin-link"><NavIcon icon={icon}/>{label}</Link>)}</aside><main className="admin-main"><header className="admin-header"><div><button className="icon-button"><Menu/></button><span>لوحة الإدارة</span></div><div><button className="icon-button"><Bell size={19}/></button>{isCurrentUserLoading ? <span className="avatar avatar-sm" aria-label="يجري تحميل الحساب"/> : currentPerson ? <Avatar person={currentPerson} size="sm"/> : <Link href="/login" className="icon-button" aria-label="تسجيل الدخول"><Icons.LogIn size={18}/></Link>}</div></header>{children}</main></div>;
}
