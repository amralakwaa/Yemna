import { useQuery } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Lock, ShieldCheck, UserRoundCog } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { AppShell } from "@/components/yemna/AppShell";
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from "@/contexts/CurrentUserContext";
import { api } from "@/lib/api";
import "./live-account.css";

function AccountLoadingState({ children }: { children: ReactNode }) {
  return <section className="live-account-state">{children}</section>;
}

export function LiveAccountPage() {
  const { currentUser, isAuthenticated, isLoading: sessionLoading } = useCurrentUser();
  const profileQuery = useQuery({ queryKey: CURRENT_USER_QUERY_KEY, queryFn: api.getMe, enabled: isAuthenticated, retry: 1 });
  const account = profileQuery.data ?? currentUser;
  const initials = (account?.displayName || account?.fullName || "ي").trim().slice(0, 1);
  const locationText = [account?.city, account?.governorate].filter(Boolean).join("، ");

  if (sessionLoading) return <AppShell title="الحساب"><AccountLoadingState><LoaderCircle className="animate-spin" size={28}/><p>يجري التحقق من جلسة الحساب…</p></AccountLoadingState></AppShell>;
  if (!isAuthenticated) return <AppShell title="الحساب"><AccountLoadingState><Lock size={28}/><h2>سجّل الدخول لعرض معلومات حسابك</h2><p>تظهر هنا بيانات حسابك الشخصية بعد التحقق من الجلسة.</p><Link className="button" href="/login">تسجيل الدخول</Link></AccountLoadingState></AppShell>;
  if (profileQuery.isLoading && !account) return <AppShell title="الحساب"><AccountLoadingState><LoaderCircle className="animate-spin" size={28}/><p>يجري تحميل معلومات الحساب…</p></AccountLoadingState></AppShell>;
  if (profileQuery.isError || !account) return <AppShell title="الحساب"><AccountLoadingState><CircleAlert size={28}/><h2>تعذر تحميل معلومات الحساب</h2><p>تحقق من اتصالك ثم أعد المحاولة.</p><button type="button" className="button outline" onClick={() => profileQuery.refetch()}>إعادة المحاولة</button></AccountLoadingState></AppShell>;

  return <AppShell title="الحساب"><main className="live-account-page">
    <header className="live-account-header"><span className="eyebrow">حسابك في يمنا</span><h1>معلومات الحساب</h1><p>هذه بيانات الحساب المعادة من خدمة يمنا للحساب الحالي فقط.</p></header>
    <section className="live-account-card" aria-label="بطاقة معلومات الحساب">
      <div className="live-account-identity">
        <div className="live-account-avatar">{account.avatarUrl ? <img src={account.avatarUrl} alt={`الصورة الرمزية لـ ${account.displayName || account.fullName || "الحساب"}`}/> : <span aria-hidden="true">{initials}</span>}</div>
        <div><h2>{account.displayName || account.fullName || "حساب يمنا"}</h2><p dir="ltr">@{account.username || "—"}</p><span className="live-account-status"><ShieldCheck size={16}/>{account.status === "ACTIVE" ? "الحساب نشط" : "حالة الحساب متاحة للخدمة"}</span></div>
      </div>
      <Link href="/account/edit" className="button outline live-account-edit"><UserRoundCog size={18}/>تعديل الملف الشخصي</Link>
    </section>
    <dl className="live-account-details">
      <div><dt>البريد الإلكتروني</dt><dd>{account.email || "غير مضاف"}</dd></div>
      <div><dt>رقم الهاتف</dt><dd>{account.phone || "غير مضاف"}</dd></div>
      <div><dt>المنطقة</dt><dd>{locationText || "غير محددة"}</dd></div>
      <div><dt>تاريخ الانضمام</dt><dd>{account.createdAt ? new Date(account.createdAt).toLocaleDateString("ar-YE", { month: "long", year: "numeric" }) : "غير متاح"}</dd></div>
    </dl>
    {account.bio ? <section className="live-account-bio"><h2>النبذة</h2><p>{account.bio}</p></section> : null}
    <p className="live-account-note">لا تظهر هنا إجراءات تغيير وسائل الاتصال أو الاسترداد أو التعطيل أو الحذف، لأنها لا تملك عقد خدمة حيّاً في هذه النسخة.</p>
  </main></AppShell>;
}
