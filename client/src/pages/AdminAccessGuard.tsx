import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Surface } from "@/components/yemna/UI";
import { api, ApiError, hasRestSession } from "@/lib/api";
import { AdminDetailPage } from "./AdminAISuite";
import { AIUsageAnalyticsPage } from "./CompletionSuite";
import { AdminExtraPage } from "./GapClosureSuite";

const adminExtraPaths = new Set([
  "/admin/login", "/admin/messages", "/admin/announcement", "/admin/updates", "/admin/backup",
  "/admin/maintenance", "/admin/profile", "/admin/user/detail", "/admin/report/detail",
  "/admin/content/review", "/admin/group/detail", "/admin/page/detail",
]);

function AdminAccessState({ title, detail }: { title: string; detail: string }) {
  return <div className="admin-suite" dir="rtl"><main><Surface className="admin-table-panel"><div className="p-6 text-right"><h1 className="mb-3 text-xl font-bold text-slate-900">{title}</h1><p className="m-0 text-sm leading-7 text-slate-600">{detail}</p></div></Surface></main></div>;
}

export function AdminAccessGuard() {
  const [path] = useLocation();
  const hasSession = hasRestSession();
  const access = useQuery({ queryKey: ["admin", "access"], queryFn: api.getAdminStats, enabled: hasSession, retry: false });

  if (!hasSession) return <AdminAccessState title="تسجيل الدخول مطلوب" detail="تتطلب لوحة الإدارة تسجيل الدخول بحساب يحمل صلاحية المدير. لا تُعرض بيانات أو مؤشرات إدارية في واجهة عامة." />;
  if (access.isLoading) return <AdminAccessState title="جارٍ التحقق من الصلاحية" detail="يتم التحقق من صلاحية الإدارة قبل عرض أي بيانات أو إجراءات إدارية." />;
  if (access.error) {
    const detail = access.error instanceof ApiError && access.error.status === 403
      ? "حسابك لا يحمل صلاحية المدير. لا تُعرض بيانات أو مؤشرات إدارية في هذه الجلسة."
      : "تعذر التحقق من صلاحية الإدارة. تحقق من الاتصال ثم أعد المحاولة.";
    return <AdminAccessState title="لا يمكن فتح لوحة الإدارة" detail={detail} />;
  }

  if (path === "/admin/ai-analytics") return <AIUsageAnalyticsPage />;
  if (adminExtraPaths.has(path)) return <AdminExtraPage />;
  return <AdminDetailPage />;
}
