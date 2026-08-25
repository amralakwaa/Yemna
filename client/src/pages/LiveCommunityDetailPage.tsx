import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, LockKeyhole, LogIn, MessageCircle, Settings2, ShieldCheck, Trash2, Users, WifiOff } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { SectionHeading, Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, type CommunityMemberRole } from "@/lib/api";
import "./live-community-detail.css";

function CommunityState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="content-placeholder community-detail-state">{icon}<h2>{title}</h2><p>{text}</p></div>;
}

function CommunityDetailContent({ membersOnly = false }: { membersOnly?: boolean }) {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { currentUser, isLoading: isSessionLoading, isAuthenticated } = useCurrentUser();
  const communityQuery = useQuery({ queryKey: ["rest", "communities", id], queryFn: () => api.getCommunity(id), enabled: Boolean(id), retry: 1 });
  const membersQuery = useQuery({ queryKey: ["rest", "communities", id, "members"], queryFn: () => api.getCommunityMembers(id), enabled: Boolean(id), retry: 1 });
  const myCommunitiesQuery = useQuery({ queryKey: ["rest", "communities", "mine"], queryFn: api.getMyCommunities, enabled: isAuthenticated, retry: 1 });
  const membership = Boolean(myCommunitiesQuery.data?.some((community) => community.id === id));
  const community = communityQuery.data;
  const myJoinRequestQuery = useQuery({
    queryKey: ["rest", "communities", id, "my-join-request"],
    queryFn: () => api.getMyCommunityJoinRequest(id),
    enabled: isAuthenticated && Boolean(id) && community?.visibility === "PRIVATE" && !membership,
    retry: false,
  });
  const owner = Boolean(community?.owner?.id && community.owner.id === currentUser?.id);
  const ownMembership = membersQuery.data?.find((member) => member.userId === currentUser?.id || member.user.id === currentUser?.id);
  const viewerRole: CommunityMemberRole | undefined = ownMembership?.role;
  const canReviewRequests = owner || viewerRole === "ADMIN" || viewerRole === "MODERATOR";
  const membershipMutation = useMutation({
    mutationFn: () => membership ? api.leaveCommunity(id) : api.joinCommunity(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", id] });
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", id, "members"] });
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities"] });
      toast.success(membership ? "غادرت المجتمع" : "تم الانضمام إلى المجتمع");
    },
    onError: () => toast.error(membership ? "تعذر مغادرة المجتمع حالياً." : "تعذر الانضمام إلى المجتمع حالياً."),
  });
  const joinRequestMutation = useMutation({
    mutationFn: () => api.requestCommunityJoin(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", id, "my-join-request"] });
      toast.success("تم إرسال طلب الانضمام للمراجعة");
    },
    onError: () => toast.error("تعذر إرسال طلب الانضمام حالياً."),
  });
  const cancelJoinRequestMutation = useMutation({
    mutationFn: () => api.cancelCommunityJoinRequest(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities", id, "my-join-request"] });
      toast.success("تم إلغاء طلب الانضمام");
    },
    onError: () => toast.error("تعذر إلغاء طلب الانضمام حالياً."),
  });
  const conversationMutation = useMutation({
    mutationFn: () => api.getCommunityConversation(id),
    onSuccess: (conversation) => setLocation(`/messages?conversation=${encodeURIComponent(conversation.id)}`),
    onError: () => toast.error("تعذر فتح رسائل المجتمع حالياً."),
  });

  if (communityQuery.isLoading || isSessionLoading) return <CommunityState icon={<LoaderCircle className="animate-spin" size={28}/>} title="يجري تحميل المجتمع" text="انتظر لحظة بينما نجلب بيانات المجتمع الفعلية."/>;
  if (communityQuery.isError || !community) return <CommunityState icon={<WifiOff size={28}/>} title="تعذر تحميل المجتمع" text="قد يكون المجتمع غير موجود أو لا يمكن الوصول إليه حالياً."/>;

  const members = membersQuery.data ?? [];
  return <main className="live-community-detail">
    <Link className="detail-back-link" href="/communities"><ArrowRight size={18}/> العودة إلى المجتمعات</Link>
    {!membersOnly ? <Surface className="live-community-detail-hero">
      {community.coverUrl ? <img className="community-detail-cover" src={community.coverUrl} alt=""/> : <div className="community-detail-art" aria-hidden="true"><Users size={44}/></div>}
      <div className="community-detail-copy">
        <span className="eyebrow">{community.visibility === "PRIVATE" ? "مجتمع خاص" : "مجتمع عام"}</span>
        <h1>{community.name}</h1>
        {community.description ? <p>{community.description}</p> : <p>لا توجد نبذة منشورة عن هذا المجتمع بعد.</p>}
        <div className="community-detail-meta"><span><Users size={16}/>{community._count?.members ?? members.length} عضو</span>{community._count?.posts !== undefined ? <span>{community._count.posts} منشور</span> : null}</div>
        {!isAuthenticated ? <Link className="button" href={`/login?next=/community/${encodeURIComponent(id)}`}><LogIn size={17}/> سجّل الدخول للانضمام</Link> : <div className="community-action-row">
          {!isAuthenticated ? <Link className="button" href={`/login?next=/community/${encodeURIComponent(id)}`}>سجّل الدخول للانضمام</Link> : owner ? <span className="community-owner-label"><ShieldCheck size={16}/> أنت مالك هذا المجتمع</span> : membership ? <button className="button secondary" type="button" disabled={membershipMutation.isPending || myCommunitiesQuery.isLoading} onClick={() => membershipMutation.mutate()}>{membershipMutation.isPending ? "جارٍ الحفظ…" : "مغادرة المجتمع"}</button> : community.visibility === "PRIVATE" ? <PrivateJoinAction status={myJoinRequestQuery.data?.status} loading={myJoinRequestQuery.isLoading} pending={joinRequestMutation.isPending || cancelJoinRequestMutation.isPending} onRequest={() => joinRequestMutation.mutate()} onCancel={() => cancelJoinRequestMutation.mutate()}/> : <button className="button" type="button" disabled={membershipMutation.isPending || myCommunitiesQuery.isLoading} onClick={() => membershipMutation.mutate()}>{membershipMutation.isPending ? "جارٍ الحفظ…" : "انضمام"}</button>}
          {membership ? <button className="button secondary" type="button" disabled={conversationMutation.isPending} onClick={() => conversationMutation.mutate()}><MessageCircle size={17}/>{conversationMutation.isPending ? "جارٍ الفتح…" : "رسائل المجتمع"}</button> : null}
          {owner ? <Link className="button secondary" href={`/community/${encodeURIComponent(id)}/manage`}><Settings2 size={17}/> إعدادات المجتمع</Link> : null}
          {canReviewRequests ? <Link className="button secondary" href={`/community/${encodeURIComponent(id)}/manage#requests`}><Settings2 size={17}/> إدارة المجتمع</Link> : null}
        </div>}
      </div>
    </Surface> : <SectionHeading title={`أعضاء ${community.name}`} action={<Link href={`/community/${encodeURIComponent(id)}`}>عن المجتمع</Link>}/>} 
    <section className="live-community-members" aria-live="polite">
      <SectionHeading title={membersOnly ? "قائمة الأعضاء" : "الأعضاء"} action={!membersOnly ? <Link href={`/community/${encodeURIComponent(id)}/members`}>عرض الكل</Link> : undefined}/>
      {membersQuery.isLoading ? <CommunityState icon={<LoaderCircle className="animate-spin" size={24}/>} title="يجري تحميل الأعضاء" text=""/> : membersQuery.isError ? <CommunityState icon={<WifiOff size={24}/>} title="تعذر تحميل الأعضاء" text="تحقق من اتصالك ثم أعد المحاولة."/> : members.length === 0 ? <CommunityState icon={<Users size={24}/>} title="لا توجد عضويات معروضة" text="ستظهر قائمة الأعضاء عند وجود بيانات متاحة."/> : <CommunityMemberList members={members.slice(0, membersOnly ? undefined : 5)} communityId={id} currentUserId={currentUser?.id} isOwner={owner} viewerRole={viewerRole}/>}
    </section>
    {community.visibility === "PRIVATE" ? <p className="community-privacy-note"><LockKeyhole size={15}/> قد تخضع بعض معلومات المجتمع الخاص لضوابط العضوية التي يحددها الخادم.</p> : null}
  </main>;
}

function PrivateJoinAction({ status, loading, pending, onRequest, onCancel }: { status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; loading: boolean; pending: boolean; onRequest: () => void; onCancel: () => void }) {
  if (loading) return <button className="button" type="button" disabled>يجري التحقق…</button>;
  if (status === "PENDING") return <><span className="community-request-status">طلبك قيد المراجعة</span><button className="button secondary" type="button" disabled={pending} onClick={onCancel}>إلغاء الطلب</button></>;
  if (status === "APPROVED") return <span className="community-request-status">تمت الموافقة، حدّث الصفحة للمتابعة</span>;
  return <button className="button" type="button" disabled={pending} onClick={onRequest}>{pending ? "جارٍ الإرسال…" : status === "REJECTED" ? "إرسال طلب جديد" : "طلب الانضمام"}</button>;
}

function CommunityMemberList({ members, communityId, currentUserId, isOwner, viewerRole }: { members: Awaited<ReturnType<typeof api.getCommunityMembers>>; communityId: string; currentUserId?: string; isOwner: boolean; viewerRole?: CommunityMemberRole }) {
  const queryClient = useQueryClient();
  const canRemove = isOwner || viewerRole === "ADMIN" || viewerRole === "MODERATOR";
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: CommunityMemberRole }) => api.updateCommunityMemberRole(communityId, userId, role),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["rest", "communities", communityId, "members"] }); toast.success("تم تحديث دور العضو"); },
    onError: () => toast.error("تعذر تحديث دور العضو."),
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeCommunityMember(communityId, userId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["rest", "communities", communityId, "members"] }); void queryClient.invalidateQueries({ queryKey: ["rest", "communities", communityId] }); toast.success("تمت إزالة العضو من المجتمع"); },
    onError: () => toast.error("تعذر إزالة العضو."),
  });

  return <div className="community-member-list">{members.map(({ id: membershipId, userId, user, role }) => {
    const normalized = (value: unknown) => typeof value === "string" && value.trim() && value !== "null" && value !== "undefined" ? value.trim() : "";
    const stableUserId = normalized(user.id) || normalized(userId);
    const username = normalized(user.username);
    const profileIdentifier = username || stableUserId;
    const isTargetOwner = isOwner && stableUserId === currentUserId;
    const mayRemoveTarget = canRemove && Boolean(stableUserId) && !isTargetOwner && (isOwner || role === "MEMBER");
    return <Surface key={membershipId} className="community-member-row"><div className="member-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt=""/> : user.displayName.slice(0, 1)}</div><div className="community-member-copy">{profileIdentifier ? <Link href={`/profile/${encodeURIComponent(profileIdentifier)}`}>{user.displayName}</Link> : <span className="member-profile-unavailable">{user.displayName}</span>}<small>{username ? `@${username}` : "عضو بلا اسم مستخدم"}{role ? ` · ${role}` : ""}</small>{user.bio ? <p>{user.bio}</p> : null}</div>{isOwner && stableUserId && !isTargetOwner ? <label className="community-role-picker"><span className="sr-only">دور {user.displayName}</span><select value={role ?? "MEMBER"} disabled={roleMutation.isPending} onChange={(event) => roleMutation.mutate({ userId: stableUserId, role: event.target.value as CommunityMemberRole })}><option value="MEMBER">عضو</option><option value="MODERATOR">مشرف</option><option value="ADMIN">مدير</option></select></label> : null}{mayRemoveTarget ? <button className="community-remove-member" type="button" disabled={removeMutation.isPending} onClick={() => { if (window.confirm(`إزالة ${user.displayName} من المجتمع؟`)) removeMutation.mutate(stableUserId); }} aria-label={`إزالة ${user.displayName}`}><Trash2 size={17}/><span>إزالة</span></button> : null}</Surface>;
  })}</div>;
}

export function LiveCommunityDetailPage() { return <AppShell title="تفاصيل المجتمع"><CommunityDetailContent/></AppShell>; }
export function LiveCommunityMembersPage() { return <AppShell title="أعضاء المجتمع"><CommunityDetailContent membersOnly/></AppShell>; }
