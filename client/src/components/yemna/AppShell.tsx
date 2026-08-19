/** فلسفة يمنا: هيكل متجاوب RTL يوحّد سطح المكتب والهاتف دون تصغير قسري لواجهة سطح المكتب. */
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import * as Icons from "lucide-react";
import { Bell, ChevronDown, Menu, MessageCircle, Moon, Plus, Search, X } from "lucide-react";
import { navItems, people } from "@/lib/yemnaData";
import { Avatar, SearchBox } from "./UI";
import { YemnaLogo } from "./YemnaLogo";

const sideItems = [
  ...navItems.slice(0, 4),
  { key: "pages", label: "الصفحات", path: "/communities", icon: "Flag" },
  { key: "events", label: "الفعاليات", path: "/media", icon: "CalendarDays" },
  navItems[5],
  { key: "saved", label: "المحفوظات", path: "/media", icon: "Bookmark" },
  navItems[4],
  { key: "discover", label: "استكشاف", path: "/search", icon: "Compass" },
  { key: "settings", label: "الإعدادات والخصوصية", path: "/settings", icon: "Settings" },
];

function NavIcon({ icon, size = 20 }: { icon: string; size?: number }) { const Component = Icons[icon as keyof typeof Icons] as React.ComponentType<{size?: number}>; return Component ? <Component size={size}/> : <Icons.Circle size={size}/>; }

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const is = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  return <div className="app-shell">
    <header className="desktop-header">
      <YemnaLogo compact/>
      <SearchBox />
      <nav className="top-nav" aria-label="التنقل الرئيسي">{navItems.map((item) => <Link key={item.key} href={item.path} className={is(item.path) ? "top-nav-link active" : "top-nav-link"}><span className="relative"><NavIcon icon={item.icon} size={23}/>{item.badge && <i className="nav-badge">{item.badge}</i>}</span><small>{item.label}</small></Link>)}</nav>
      <div className="header-profile"><Avatar person={people[0]}/><strong>عمر الحضرمي</strong><ChevronDown size={16}/></div>
    </header>
    <header className="mobile-header"><button className="icon-button"><Menu/></button><YemnaLogo compact/><div><Link href="/search" className="icon-button"><Search/></Link><Link href="/notifications" className="icon-button"><Bell/></Link></div></header>
    <main className="desktop-layout">
      <aside className="sidebar-right"><nav>{sideItems.map((item) => <Link key={item.key} href={item.path} className={is(item.path) ? "side-link active" : "side-link"}><span className="relative"><NavIcon icon={item.icon}/>{item.badge && <i className="nav-badge">{item.badge}</i>}</span><span>{item.label}</span></Link>)}</nav><div className="sidebar-bottom"><button className="theme-row"><Moon size={18}/> الوضع الداكن <span className="fake-switch"/></button><small>© 2025 يمنا<br/>جميع الحقوق محفوظة</small></div></aside>
      <section className="page-stage">{title && <div className="mobile-page-title"><h1>{title}</h1></div>}{children}</section>
    </main>
    <nav className="mobile-nav" aria-label="التنقل السفلي"><Link href="/" className={is("/") ? "active" : ""}><Icons.House size={20}/><span>الرئيسية</span></Link><Link href="/friends"><Icons.Users size={20}/><span>الأصدقاء</span></Link><Link href="/create" className="create-nav"><Plus size={25}/></Link><Link href="/notifications"><span className="relative"><Icons.Bell size={20}/><i className="nav-badge">3</i></span><span>الإشعارات</span></Link><Link href="/settings"><Icons.Menu size={20}/><span>القائمة</span></Link></nav>
  </div>;
}

export function AdminShell({ children }: { children: ReactNode }) { return <div className="admin-shell"><aside className="admin-side"><YemnaLogo compact/><div className="admin-person"><Avatar person={people[0]}/><strong>عمر بلال الأكوع</strong><span>مدير النظام</span></div>{[["LayoutDashboard","لوحة التحكم","/admin"],["Users","المستخدمون","/admin"],["FileText","إدارة المحتوى","/admin"],["ShieldAlert","مركز البلاغات","/admin"],["BarChart3","التقارير والإحصائيات","/admin"],["Settings","إعدادات النظام","/admin"]].map(([icon,label,path])=><Link href={path} key={label} className="admin-link"><NavIcon icon={icon}/>{label}</Link>)}</aside><main className="admin-main"><header className="admin-header"><div><button className="icon-button"><Menu/></button><span>لوحة الإدارة</span></div><div><button className="icon-button"><Bell size={19}/></button><Avatar person={people[0]} size="sm"/></div></header>{children}</main></div>; }
