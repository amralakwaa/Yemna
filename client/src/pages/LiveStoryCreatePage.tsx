import { LoaderCircle, Lock } from "lucide-react";
import { Link } from "wouter";

import { AppShell } from "@/components/yemna/AppShell";
import { Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { CreateStoryPage } from "./ReferenceSuite";

/**
 * يترك نموذج إنشاء القصة المستند إلى REST متاحاً للحساب المصادق فقط.
 * لا يُظهر للضيف منتقي ملفات أو نجاحاً محلياً لا يمكن للخادم حفظه.
 */
export function LiveStoryCreatePage() {
  const { currentUser, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <AppShell title="إنشاء قصة">
        <main className="detail-narrow" aria-live="polite">
          <Surface className="content-placeholder">
            <LoaderCircle className="animate-spin" size={28} />
            <p>يجري التحقق من جلستك…</p>
          </Surface>
        </main>
      </AppShell>
    );
  }

  if (!currentUser) {
    return (
      <AppShell title="إنشاء قصة">
        <main className="detail-narrow">
          <Surface className="content-placeholder">
            <Lock size={28} />
            <h1>سجّل الدخول لإنشاء قصة</h1>
            <p>لن نبدأ رفع صورة أو فيديو قبل أن تتوفر جلسة صالحة لحسابك.</p>
            <Link href="/login" className="button">تسجيل الدخول</Link>
          </Surface>
        </main>
      </AppShell>
    );
  }

  return <CreateStoryPage />;
}
