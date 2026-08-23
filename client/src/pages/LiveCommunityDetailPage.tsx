import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, LockKeyhole, LogIn, Users, WifiOff } from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { SectionHeading, Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api } from "@/lib/api";
import "./live-community-detail.css";

function CommunityState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="content-placeholder community-detail-state">{icon}<h2>{title}</h2><p>{text}</p></div>;
}

function CommunityDetailContent({ membersOnly = false }: { membersOnly?: boolean }) {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentUser, isLoading: isSessionLoading, isAuthenticated } = useCurrentUser();
  const communityQuery = useQuery({ queryKey: ["rest", "communities", id], queryFn: () => api.getCommunity(id), enabled: Boolean(id), retry: 1 });
  const membersQuery = useQuery({ queryKey: ["rest", "communities", id, "members"], queryFn: () => api.getCommunityMembers(id), enabled: Boolean(id), retry: 1 });
  const myCommunitiesQuery = useQuery({ queryKey: ["rest", "communities", "mine"], queryFn: api.getMyCommunities, enabled: isAuthenticated, retry: 1 });
  const membership = Boolean(myCommunitiesQuery.data?.some((community) => community.id === id));
  const community = communityQuery.data;
  const owner = Boolean(community?.owner?.id && community.owner.id === currentUser?.id);
  const mutation = useMutation({
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
        {!isAuthenticated ? <Link className="button" href={`/login?next=/community/${encodeURIComponent(id)}`}><LogIn size={17}/> سجّل الدخول للانضمام</Link> : owner ? <span className="community-owner-label">أنت مالك هذا المجتمع</span> : <button className={membership ? "button secondary" : "button"} type="button" disabled={mutation.isPending || myCommunitiesQuery.isLoading} onClick={() => mutation.mutate()}>{mutation.isPending ? "جارٍ الحفظ…" : membership ? "مغادرة المجتمع" : "انضمام"}</button>}
      </div>
    </Surface> : <SectionHeading title={`أعضاء ${community.name}`} action={<Link href={`/community/${encodeURIComponent(id)}`}>عن المجتمع</Link>}/>} 
    <section className="live-community-members" aria-live="polite">
      <SectionHeading title={membersOnly ? "قائمة الأعضاء" : "الأعضاء"} action={!membersOnly ? <Link href={`/community/${encodeURIComponent(id)}/members`}>عرض الكل</Link> : undefined}/>
      {membersQuery.isLoading ? <CommunityState icon={<LoaderCircle className="animate-spin" size={24}/>} title="يجري تحميل الأعضاء" text=""/> : membersQuery.isError ? <CommunityState icon={<WifiOff size={24}/>} title="تعذر تحميل الأعضاء" text="تحقق من اتصالك ثم أعد المحاولة."/> : members.length === 0 ? <CommunityState icon={<Users size={24}/>} title="لا توجد عضويات معروضة" text="ستظهر قائمة الأعضاء عند وجود بيانات متاحة."/> : <div className="community-member-list">{members.slice(0, membersOnly ? undefined : 5).map(({ id: membershipId, userId, user, role }) => {
        const normalizeIdentifier = (value: unknown) => {
          if (typeof value !== "string") return "";
          const normalized = value.trim();
          return normalized === "null" || normalized === "undefined" ? "" : normalized;
        };
        const username = normalizeIdentifier(user.username);
        const profileIdentifier = username || normalizeIdentifier(user.id) || normalizeIdentifier(userId);
        return <Surface key={membershipId} className="community-member-row"><div className="member-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt=""/> : user.displayName.slice(0, 1)}</div><div>{profileIdentifier ? <Link href={`/profile/${encodeURIComponent(profileIdentifier)}`}>{user.displayName}</Link> : <span className="member-profile-unavailable">{user.displayName}</span>}<small>{username ? `@${username}` : "عضو بلا اسم مستخدم"}{role ? ` · ${role}` : ""}</small>{user.bio ? <p>{user.bio}</p> : null}</div></Surface>;
      })}</div>}
    </section>
    {community.visibility === "PRIVATE" ? <p className="community-privacy-note"><LockKeyhole size={15}/> قد تخضع بعض معلومات المجتمع الخاص لضوابط العضوية التي يحددها الخادم.</p> : null}
  </main>;
}

export function LiveCommunityDetailPage() { return <AppShell title="تفاصيل المجتمع"><CommunityDetailContent/></AppShell>; }
export function LiveCommunityMembersPage() { return <AppShell title="أعضاء المجتمع"><CommunityDetailContent membersOnly/></AppShell>; }
