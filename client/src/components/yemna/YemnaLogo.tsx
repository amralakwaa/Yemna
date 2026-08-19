/** فلسفة يمنا: شعار عربي عنابي واضح دون استبدال هوية المنصة المرجعية. */
import { Link } from "wouter";

export function YemnaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="yemna-logo" aria-label="يمنا - الصفحة الرئيسية">
      <span className="wordmark">يمنا</span>
      {!compact && <span className="logo-subtitle">منصة التواصل والمجتمع اليمني</span>}
    </Link>
  );
}
