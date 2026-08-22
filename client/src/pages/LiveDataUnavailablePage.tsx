import { Link, useLocation } from "wouter";
import { AppShell } from "@/components/yemna/AppShell";
import { Radio } from "lucide-react";

const routeTitles: Record<string, string> = {
  "/search/advanced": "البحث المتقدم",
  "/search/voice": "البحث الصوتي",
  "/discover": "اكتشف",
  "/discover/map": "اكتشاف محلي",
  "/discover/interests": "الاهتمامات",
  "/reels": "Reels",
  "/reels/view": "مشاهدة Reel",
  "/reels/create": "إنشاء Reel",
  "/reels/audio": "أصوات Reels",
  "/reels/edit": "تحرير Reel",
  "/reels/categories": "فئات Reels",
  "/live": "بث مباشر",
  "/live/view": "مشاهدة بث",
  "/live/create": "إنشاء بث",
  "/live/info": "معلومات البث",
  "/live/active": "البث النشط",
  "/live/previous": "البث السابق",
  "/friends/mutual": "الأصدقاء المشتركون",
  "/friendship/manage": "إدارة العلاقة",
  "/blocked": "الحسابات المحظورة",
  "/blocked/unblock": "إلغاء الحظر",
  "/messages/new": "رسالة جديدة",
  "/messages/chat": "المحادثة",
  "/messages/info": "معلومات المحادثة",
  "/messages/group": "محادثة جماعية",
  "/messages/group/create": "إنشاء محادثة جماعية",
  "/calls": "المكالمات",
  "/call/incoming": "مكالمة واردة",
  "/call/active": "مكالمة نشطة",
  "/notifications/settings": "إعدادات الإشعارات",
  "/pages/create": "إنشاء صفحة",
  "/pages/manage": "إدارة الصفحات",
  "/communities/local": "المجتمعات المحلية",
  "/communities/governorates": "المحافظات والمدن",
  "/communities/universities": "مجتمعات الجامعات",
  "/communities/interests": "مجتمعات الاهتمامات",
  "/communities/nearby": "اكتشاف مجتمع قريب",
  "/communities/notifications": "إشعارات المجتمع",
  "/communities/search": "البحث في المجتمعات",
  "/communities/location": "موقع المجتمع",
  "/community/old-sanaa": "صفحة المجتمع",
  "/community/sanaa": "صفحة المجتمع",
  "/community/page": "صفحة المجتمع",
  "/page/yemna": "الصفحة",
  "/community/join": "انضمام إلى مجتمع",
  "/community/members": "أعضاء المجتمع",
  "/community/manage": "إدارة المجتمع",
  "/community/info": "معلومات المجتمع",
  "/events": "الفعاليات",
  "/events/1": "تفاصيل الفعالية",
  "/events/create": "إنشاء فعالية",
  "/files": "ملفاتك",
  "/help": "مركز المساعدة",
  "/help/faq": "الأسئلة الشائعة",
  "/help/report": "الإبلاغ عن مشكلة",
  "/help/report/status": "حالة البلاغ",
  "/help/contact": "التواصل مع الدعم",
  "/account": "الحساب",
  "/account/info": "معلومات الحساب",
  "/account/edit": "تعديل الحساب",
  "/account/contact/email": "تغيير البريد الإلكتروني",
  "/account/contact/phone": "تغيير رقم الهاتف",
  "/account/recovery": "استعادة الحساب",
  "/account/disable": "تعطيل الحساب",
  "/account/delete": "حذف الحساب",
  "/settings/privacy": "الخصوصية",
  "/settings/security": "الأمان",
  "/settings/sessions": "الجلسات",
  "/settings/notifications": "إعدادات الإشعارات",
  "/settings/data": "بياناتك",
};

export function LiveDataUnavailablePage() {
  const [location] = useLocation();
  const title = routeTitles[location] ?? "هذه الميزة";

  return (
    <AppShell title={title}>
      <section className="live-data-unavailable" aria-live="polite">
        <span className="live-data-unavailable__icon"><Radio size={24} /></span>
        <h1>{title}</h1>
        <p>هذه الشاشة قيد الربط بمصدر بيانات حقيقي. لن نعرض اقتراحات أو أرقام مشاهدة أو تفاعلات تجريبية مكان بيانات مجتمع يمنا.</p>
        <p className="live-data-unavailable__note">يمكنك استخدام البحث والمجتمعات والمنشورات المتاحة حالياً إلى أن يكتمل الربط.</p>
        <div className="live-data-unavailable__actions">
          <Link href="/search" className="button">البحث في يمنا</Link>
          <Link href="/communities" className="button outline">استكشف المجتمعات</Link>
        </div>
      </section>
    </AppShell>
  );
}
