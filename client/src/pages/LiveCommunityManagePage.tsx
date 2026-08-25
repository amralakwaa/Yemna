import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, Crown, FileText, LoaderCircle, Save, Settings2, ShieldCheck, UserRoundCheck, UsersRound, WifiOff, X } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, type ApiCommunityAuditLog, type ApiCommunityJoinRequest, type CommunityMemberRole, type UpdateCommunityPayload } from "@/lib/api";
import "./live-community-detail.css";

function ManageState({ title, text, appTitle = "إدارة المجتمع", action }: { title: string; text: string; appTitle?: string; action?: React.ReactNode }) {
  return <AppShell title={appTitle}><main className="live-community-detail"><Surface className="content-placeholder community-detail-state"><Settings2 size={28}/><h2>{title}</h2><p>{text}</p>{action}</Surface></main></AppShell>;
}

function memberId(member: Awaited<ReturnType<typeof api.getCommunityMembers>>[number]) {
  return typeof member.user.id === "string" ? member.user.id : typeof member.userId === "string" ? member.userId : "";
}

function actorName(user?: { displayName: string; username?: string | null } | null) {
  if (!user) return "حساب غير متاح";
  return user.username ? `${user.displayName} (@${user.username})` : user.displayName;
}

const auditLabels: Record<ApiCommunityAuditLog["action"], string> = {
  COMMUNITY_CREATED: "أُنشئ المجتمع",
  SETTINGS_UPDATED: "حُدّثت إعدادات المجتمع",
  MEMBER_JOINED: "انضم عضو إلى المجتمع",
  MEMBER_LEFT: "غادر عضو المجتمع",
  MEMBER_REMOVED: "أُزيل عضو من المجتمع",
  MEMBER_ROLE_UPDATED: "تغيّر دور عضو",
  JOIN_REQUEST_CREATED: "أُرسل طلب انضمام",
  JOIN_REQUEST_CANCELLED: "أُلغي طلب انضمام",
  JOIN_REQUEST_APPROVED: "قُبل طلب انضمام",
  JOIN_REQUEST_REJECTED: "رُفض طلب انضمام",
  OWNERSHIP_TRANSFERRED: "نُقلت ملكية المجتمع",
};

function requestUser(request: ApiCommunityJoinRequest) {
  return request.user ? actorName(request.user) : "عضو غير متاح";
}

export function LiveCommunityManagePage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { currentUser, isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const communityQuery = useQuery({ queryKey: ["rest", "communities", id], queryFn: () => api.getCommunity(id), enabled: Boolean(id), retry: 1 });
  const membersQuery = useQuery({ queryKey: ["rest", "communities", id, "members"], queryFn: () => api.getCommunityMembers(id), enabled: isAuthenticated && Boolean(id), retry: 1 });
  const [form, setForm] = useState<UpdateCommunityPayload>({});
  const [transferTargetId, setTransferTargetId] = useState("");

  const community = communityQuery.data;
  const ownMembership = membersQuery.data?.find(member => memberId(member) === currentUser?.id);
  const viewerRole: CommunityMemberRole | undefined = ownMembership?.role;
  const isOwner = Boolean(community?.owner?.id && community.owner.id === currentUser?.id);
  const canModerate = isOwner || viewerRole === "ADMIN" || viewerRole === "MODERATOR";
  const joinRequestsQuery = useQuery({ queryKey: ["rest", "communities", id, "join-requests"], queryFn: () => api.getCommunityJoinRequests(id), enabled: canModerate && Boolean(id), retry: 1 });
  const auditQuery = useQuery({ queryKey: ["rest", "communities", id, "audit-log"], queryFn: () => api.getCommunityAuditLog(id), enabled: canModerate && Boolean(id), retry: 1 });

  useEffect(() => {
    if (!community) return;
    setForm({ name: community.name, description: community.description ?? "", coverUrl: community.coverUrl ?? "", visibility: community.visibility ?? "PUBLIC" });
  }, [community]);

  const invalidateCommunity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rest", "communities", id] }),
      queryClient.invalidateQueries({ queryKey: ["rest", "communities", id, "members"] }),
      queryClient.invalidateQueries({ queryKey: ["rest", "communities", id, "join-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["rest", "communities", id, "audit-log"] }),
      queryClient.invalidateQueries({ queryKey: ["rest", "communities", "mine"] }),
      queryClient.invalidateQueries({ queryKey: ["rest", "communities"] }),
    ]);
  };

  const settingsMutation = useMutation({
    mutationFn: () => api.updateCommunity(id, { ...form, description: form.description?.trim() || undefined, coverUrl: form.coverUrl?.trim() || undefined }),
    onSuccess: async () => { await invalidateCommunity(); toast.success("تم حفظ إعدادات المجتمع"); },
    onError: () => toast.error("تعذر حفظ إعدادات المجتمع حالياً."),
  });
  const requestDecisionMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: "APPROVE" | "REJECT" }) => api.respondToCommunityJoinRequest(id, requestId, action),
    onSuccess: async (_request, values) => { await invalidateCommunity(); toast.success(values.action === "APPROVE" ? "تم قبول طلب الانضمام" : "تم رفض طلب الانضمام"); },
    onError: () => toast.error("تعذر تحديث طلب الانضمام حالياً."),
  });
  const transferMutation = useMutation({
    mutationFn: () => api.transferCommunityOwnership(id, transferTargetId),
    onSuccess: async () => { await invalidateCommunity(); toast.success("تم نقل ملكية المجتمع"); setLocation(`/community/${encodeURIComponent(id)}`); },
    onError: () => toast.error("تعذر نقل ملكية المجتمع حالياً."),
  });

  if (isSessionLoading || communityQuery.isLoading || (isAuthenticated && membersQuery.isLoading)) return <ManageState title="يجري تحميل الإدارة" text="انتظر لحظة بينما نتحقق من صلاحياتك وبيانات المجتمع."/>;
  if (!isAuthenticated) return <ManageState title="سجّل الدخول للمتابعة" text="إدارة المجتمع متاحة للمالك والمديرين والمشرفين المخولين." action={<Link className="button" href={`/login?next=/community/${encodeURIComponent(id)}/manage`}>تسجيل الدخول</Link>}/>;
  if (communityQuery.isError || !community) return <ManageState title="تعذر تحميل المجتمع" text="قد يكون المجتمع غير موجود أو لا يمكن الوصول إليه حالياً."/>;
  if (!canModerate) return <ManageState title="لا تملك صلاحية الإدارة" text="مراجعة الطلبات والسجل الإداري متاحة للمالك أو المدير أو المشرف فقط." action={<Link className="button secondary" href={`/community/${encodeURIComponent(id)}`}>العودة إلى المجتمع</Link>}/>;

  const transferCandidates = (membersQuery.data ?? []).filter(member => memberId(member) && memberId(member) !== community.owner?.id);
  return <AppShell title="إدارة المجتمع"><main className="live-community-detail community-manage-page">
    <Link className="detail-back-link" href={`/community/${encodeURIComponent(id)}`}><ArrowRight size={18}/> العودة إلى المجتمع</Link>
    <Surface className="community-manage-card community-manage-heading-card"><div className="community-manage-heading"><div className="community-manage-icon"><ShieldCheck size={22}/></div><div><span className="eyebrow">إدارة المجتمع</span><h1>{community.name}</h1><p>{isOwner ? "تتحكم في الإعدادات والمراجعات وسجل التغييرات وملكية المجتمع." : "يمكنك مراجعة طلبات الانضمام وسجل التغييرات وفق دورك الحالي."}</p></div></div></Surface>

    {isOwner ? <Surface className="community-manage-card"><div className="community-section-title"><div><Settings2 size={20}/><h2>الإعدادات الأساسية</h2></div><span>للمالك فقط</span></div><form className="community-manage-form" onSubmit={(event) => { event.preventDefault(); settingsMutation.mutate(); }}><label>اسم المجتمع<input value={form.name ?? ""} onChange={(event) => setForm(current => ({ ...current, name: event.target.value }))} minLength={2} maxLength={100} required/></label><label>نبذة المجتمع<textarea value={form.description ?? ""} onChange={(event) => setForm(current => ({ ...current, description: event.target.value }))} maxLength={1000} rows={5} placeholder="اكتب نبذة مختصرة وواضحة عن المجتمع"/></label><label>رابط صورة الغلاف <span>اختياري</span><input type="url" dir="ltr" value={form.coverUrl ?? ""} onChange={(event) => setForm(current => ({ ...current, coverUrl: event.target.value }))} maxLength={2048} placeholder="https://…"/></label><fieldset><legend>خصوصية المجتمع</legend><label className="community-visibility-choice"><input type="radio" name="visibility" checked={(form.visibility ?? "PUBLIC") === "PUBLIC"} onChange={() => setForm(current => ({ ...current, visibility: "PUBLIC" }))}/><span><strong>عام</strong><small>يستطيع المستخدم الانضمام مباشرةً ورؤية المعلومات الأساسية.</small></span></label><label className="community-visibility-choice"><input type="radio" name="visibility" checked={form.visibility === "PRIVATE"} onChange={() => setForm(current => ({ ...current, visibility: "PRIVATE" }))}/><span><strong>خاص</strong><small>يرسل المستخدم طلب انضمام يُراجع من المالك أو المدير أو المشرف.</small></span></label></fieldset><div className="community-manage-actions"><button className="button" type="submit" disabled={settingsMutation.isPending}><Save size={17}/>{settingsMutation.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}</button></div></form></Surface> : null}

    <div id="requests"><Surface className="community-manage-card"><div className="community-section-title"><div><UsersRound size={20}/><h2>طلبات الانضمام</h2></div><span>{joinRequestsQuery.data?.length ?? 0} معلّقة</span></div><p className="community-management-hint">قبول الطلب يضيف العضو تلقائياً إلى المجتمع ومحادثته الجماعية. الرفض لا ينشئ عضوية.</p>{joinRequestsQuery.isLoading ? <ManagementState icon={<LoaderCircle className="animate-spin" size={22}/>} text="يجري تحميل الطلبات…"/> : joinRequestsQuery.isError ? <ManagementState icon={<WifiOff size={22}/>} text="تعذر تحميل طلبات الانضمام."/> : (joinRequestsQuery.data?.length ?? 0) === 0 ? <ManagementState icon={<UserRoundCheck size={22}/>} text="لا توجد طلبات انضمام معلّقة حالياً."/> : <div className="community-request-list">{joinRequestsQuery.data?.map(request => <div key={request.id} className="community-request-row"><div className="member-avatar">{request.user?.avatarUrl ? <img src={request.user.avatarUrl} alt=""/> : request.user?.displayName.slice(0, 1) ?? "؟"}</div><div className="community-request-copy"><strong>{requestUser(request)}</strong><small>{request.user?.username ? `@${request.user.username}` : "طلب انضمام جديد"}</small>{request.user?.bio ? <p>{request.user.bio}</p> : null}</div><div className="community-request-actions"><button className="button" type="button" disabled={requestDecisionMutation.isPending} onClick={() => requestDecisionMutation.mutate({ requestId: request.id, action: "APPROVE" })}>قبول</button><button className="button secondary" type="button" disabled={requestDecisionMutation.isPending} onClick={() => requestDecisionMutation.mutate({ requestId: request.id, action: "REJECT" })}><X size={16}/> رفض</button></div></div>)}</div>}</Surface></div>

    {isOwner ? <Surface className="community-manage-card community-transfer-card"><div className="community-section-title"><div><Crown size={20}/><h2>نقل ملكية المجتمع</h2></div><span>قرار حساس</span></div><p className="community-management-hint">بعد النقل يصبح العضو المحدد مالكاً للمجتمع، وتبقى عضويتك إدارية حتى يمكن للمالك الجديد تعديلها لاحقاً.</p>{transferCandidates.length === 0 ? <ManagementState icon={<UsersRound size={22}/>} text="أضف عضواً واحداً على الأقل قبل نقل الملكية."/> : <div className="community-transfer-controls"><label>المالك الجديد<select value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)}><option value="">اختر عضواً حالياً</option>{transferCandidates.map(member => <option key={memberId(member)} value={memberId(member)}>{member.user.displayName}{member.user.username ? ` — @${member.user.username}` : ""}</option>)}</select></label><button className="button danger" type="button" disabled={!transferTargetId || transferMutation.isPending} onClick={() => { const name = transferCandidates.find(member => memberId(member) === transferTargetId)?.user.displayName ?? "هذا العضو"; if (window.confirm(`هل تريد نقل ملكية المجتمع إلى ${name}؟`)) transferMutation.mutate(); }}><Crown size={17}/>{transferMutation.isPending ? "جارٍ النقل…" : "نقل الملكية"}</button></div>}</Surface> : null}

    <Surface className="community-manage-card"><div className="community-section-title"><div><FileText size={20}/><h2>سجل الإدارة</h2></div><span>آخر 100 إجراء</span></div><p className="community-management-hint">سجل قرائي يوضح تغييرات المجتمع والطلبات والعضويات، ولا يعرض بيانات حساسة.</p>{auditQuery.isLoading ? <ManagementState icon={<LoaderCircle className="animate-spin" size={22}/>} text="يجري تحميل السجل…"/> : auditQuery.isError ? <ManagementState icon={<WifiOff size={22}/>} text="تعذر تحميل سجل الإدارة."/> : (auditQuery.data?.length ?? 0) === 0 ? <ManagementState icon={<Clock3 size={22}/>} text="لا توجد عمليات إدارية مسجلة بعد."/> : <ol className="community-audit-list">{auditQuery.data?.map(log => <li key={log.id}><div className="community-audit-icon"><Clock3 size={16}/></div><div><strong>{auditLabels[log.action]}</strong><p>بواسطة {actorName(log.actor)}{log.targetUser ? ` · العضو المعني: ${actorName(log.targetUser)}` : ""}</p><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString("ar-YE")}</time></div></li>)}</ol>}</Surface>
  </main></AppShell>;
}

function ManagementState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="community-management-state">{icon}<p>{text}</p></div>;
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
