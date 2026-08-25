import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, Save, Settings2, ShieldCheck, WifiOff } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, type UpdateCommunityPayload } from "@/lib/api";
import "./live-community-detail.css";

function ManageState({ title, text, appTitle = "إدارة المجتمع", action }: { title: string; text: string; appTitle?: string; action?: React.ReactNode }) {
  return <AppShell title={appTitle}><main className="live-community-detail"><Surface className="content-placeholder community-detail-state"><Settings2 size={28}/><h2>{title}</h2><p>{text}</p>{action}</Surface></main></AppShell>;
}

export function LiveCommunityManagePage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { currentUser, isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const communityQuery = useQuery({ queryKey: ["rest", "communities", id], queryFn: () => api.getCommunity(id), enabled: Boolean(id), retry: 1 });
  const [form, setForm] = useState<UpdateCommunityPayload>({});

  useEffect(() => {
    if (!communityQuery.data) return;
    setForm({ name: communityQuery.data.name, description: communityQuery.data.description ?? "", coverUrl: communityQuery.data.coverUrl ?? "", visibility: communityQuery.data.visibility ?? "PUBLIC" });
  }, [communityQuery.data]);

  const mutation = useMutation({
    mutationFn: () => api.updateCommunity(id, { ...form, description: form.description?.trim() || undefined, coverUrl: form.coverUrl?.trim() || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", id] });
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities"] });
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", "mine"] });
      toast.success("تم حفظ إعدادات المجتمع");
      setLocation(`/community/${encodeURIComponent(id)}`);
    },
    onError: () => toast.error("تعذر حفظ إعدادات المجتمع حالياً."),
  });

  if (isSessionLoading || communityQuery.isLoading) return <ManageState title="يجري تحميل الإعدادات" text="انتظر لحظة بينما نتحقق من صلاحية الإدارة."/>;
  if (!isAuthenticated) return <ManageState title="سجّل الدخول للمتابعة" text="إدارة المجتمع متاحة لحساب مالكه فقط." action={<Link className="button" href={`/login?next=/community/${encodeURIComponent(id)}/manage`}>تسجيل الدخول</Link>}/>;
  if (communityQuery.isError || !communityQuery.data) return <ManageState title="تعذر تحميل المجتمع" text="قد يكون المجتمع غير موجود أو لا يمكن الوصول إليه حالياً."/>;
  if (communityQuery.data.owner?.id !== currentUser?.id) return <ManageState title="هذه الصفحة للمالك فقط" text="يمكنك متابعة المجتمع أو عرض أعضائه، لكن تعديل إعداداته محصور بمالكه."/>;

  return <AppShell title="إدارة المجتمع"><main className="live-community-detail community-manage-page"><Link className="detail-back-link" href={`/community/${encodeURIComponent(id)}`}><ArrowRight size={18}/> العودة إلى المجتمع</Link><Surface className="community-manage-card"><div className="community-manage-heading"><div className="community-manage-icon"><ShieldCheck size={22}/></div><div><span className="eyebrow">إدارة المجتمع</span><h1>{communityQuery.data.name}</h1><p>حدّث التفاصيل الأساسية التي تظهر للأعضاء والزوار.</p></div></div><form className="community-manage-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label>اسم المجتمع<input value={form.name ?? ""} onChange={(event) => setForm(current => ({ ...current, name: event.target.value }))} minLength={2} maxLength={100} required/></label><label>نبذة المجتمع<textarea value={form.description ?? ""} onChange={(event) => setForm(current => ({ ...current, description: event.target.value }))} maxLength={1000} rows={5} placeholder="اكتب نبذة مختصرة وواضحة عن المجتمع"/></label><label>رابط صورة الغلاف <span>اختياري</span><input type="url" dir="ltr" value={form.coverUrl ?? ""} onChange={(event) => setForm(current => ({ ...current, coverUrl: event.target.value }))} maxLength={2048} placeholder="https://…"/></label><fieldset><legend>خصوصية المجتمع</legend><label className="community-visibility-choice"><input type="radio" name="visibility" checked={(form.visibility ?? "PUBLIC") === "PUBLIC"} onChange={() => setForm(current => ({ ...current, visibility: "PUBLIC" }))}/><span><strong>عام</strong><small>يستطيع أي مستخدم الانضمام ورؤية المعلومات الأساسية.</small></span></label><label className="community-visibility-choice"><input type="radio" name="visibility" checked={form.visibility === "PRIVATE"} onChange={() => setForm(current => ({ ...current, visibility: "PRIVATE" }))}/><span><strong>خاص</strong><small>لا يقبل الانضمام المباشر حتى تُضاف سياسة طلبات الانضمام.</small></span></label></fieldset><div className="community-manage-actions"><button className="button" type="submit" disabled={mutation.isPending}><Save size={17}/>{mutation.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}</button><button className="button secondary" type="button" onClick={() => setLocation(`/community/${encodeURIComponent(id)}`)}>إلغاء</button></div></form></Surface></main></AppShell>;
}

export function LiveCommunityMessagesPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const conversationQuery = useQuery({ queryKey: ["rest", "communities", id, "conversation"], queryFn: () => api.getCommunityConversation(id), enabled: isAuthenticated && Boolean(id), retry: 1 });
  useEffect(() => { if (conversationQuery.data?.id) setLocation(`/messages?conversation=${encodeURIComponent(conversationQuery.data.id)}`); }, [conversationQuery.data?.id, setLocation]);
  if (isSessionLoading || conversationQuery.isLoading) return <ManageState appTitle="رسائل المجتمع" title="يجري فتح الرسائل" text="نتحقق من عضويتك ثم نفتح محادثة المجتمع."/>;
  if (!isAuthenticated) return <ManageState appTitle="رسائل المجتمع" title="سجّل الدخول للرسائل" text="رسائل المجتمع متاحة لأعضائه المسجلين فقط." action={<Link className="button" href={`/login?next=/community/${encodeURIComponent(id)}/messages`}>تسجيل الدخول</Link>}/>;
  if (conversationQuery.isError) return <ManageState appTitle="رسائل المجتمع" title="تعذر فتح رسائل المجتمع" text="انضم إلى المجتمع أولاً أو حاول مجدداً بعد قليل."/>;
  return <ManageState appTitle="رسائل المجتمع" title="يجري الانتقال للرسائل" text="سيتم فتح محادثة المجتمع حالاً."/>;
}
