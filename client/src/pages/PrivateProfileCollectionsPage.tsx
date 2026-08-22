import { Clock3, FileText, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppShell } from "@/components/yemna/AppShell";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

const collectionDetails: Record<string, { title: string; description: string }> = {
  "/my-posts": { title: "منشوراتي", description: "كل ما شاركته في مجتمع يمنا." },
  "/saved": { title: "المحفوظات", description: "منشورات وعناصر تود الرجوع إليها لاحقاً." },
  "/activity": { title: "تفاعلاتك", description: "سجل إعجاباتك وتعليقاتك ومشاركاتك." },
  "/memories": { title: "ذكرياتك", description: "لحظاتك السابقة في مجتمع يمنا." },
};

/**
 * هذه المسارات شخصية، ولا يوجد لها بعد عقد REST مستقل في الخلفية. لذلك لا
 * نعرض سجلات أو وسائط تجريبية على أنها تخص المستخدم الحالي.
 */
export function PrivateProfileCollectionsPage() {
  const [location] = useLocation();
  const { currentUser, isLoading } = useCurrentUser();
  const details = collectionDetails[location] ?? collectionDetails["/my-posts"];

  return (
    <AppShell title={details.title}>
      <div className="detail-narrow collection-page">
        <section className="surface collection-intro">
          <span className="collection-icon"><FileText /></span>
          <div><h2>{details.title}</h2><p>{details.description}</p></div>
        </section>
        <section className="surface content-placeholder" aria-live="polite">
          {isLoading ? <><Clock3 className="animate-spin" size={28} /><p>يجري التحقق من حسابك…</p></> : !currentUser ? <><Lock size={28} /><h3>سجّل الدخول لعرض {details.title}</h3><p>هذه المساحة مرتبطة بحسابك ولا تُعرض للزوار.</p><Link className="button" href="/login">تسجيل الدخول</Link></> : <><Clock3 size={28} /><h3>لا تتوفر بيانات {details.title} الحية بعد</h3><p>لن نعرض عناصر تجريبية مكان بيانات حسابك. ستظهر هنا عند إتاحة العقد المرتبط بها.</p></>}
        </section>
      </div>
    </AppShell>
  );
}
