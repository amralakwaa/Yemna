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
