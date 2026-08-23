import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Check, LoaderCircle, MessageCircle, Search, ShieldOff, UserMinus, UserPlus, Users, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, SearchBox, Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, asPerson, type ApiBlock, type ApiFollow, type ApiFriend, type ApiFriendRequest, type ApiSuggestion, type ApiUser } from "@/lib/api";

type RelationshipView = "friends" | "requests" | "suggestions" | "followers" | "following" | "blocked";
type RelationshipEntry = { id: string; user: ApiUser; mutualCount?: number; isFollowing?: boolean; hasPendingFriendRequest?: boolean };

const relationshipViews: Array<{ path: string; view: RelationshipView; label: string; title: string; description: string; emptyTitle: string; emptyText: string }> = [
  { path: "/friends", view: "friends", label: "الأصدقاء", title: "الأصدقاء", description: "الأشخاص المرتبطون بك في يمنا.", emptyTitle: "لا يوجد أصدقاء بعد", emptyText: "ستظهر صداقاتك المقبولة هنا." },
  { path: "/friend-requests", view: "requests", label: "الطلبات", title: "طلبات الصداقة", description: "راجع الطلبات الواردة إلى حسابك.", emptyTitle: "لا توجد طلبات معلقة", emptyText: "ستظهر طلبات الصداقة الجديدة هنا." },
  { path: "/people/discover", view: "suggestions", label: "الاقتراحات", title: "أشخاص قد تعرفهم", description: "حسابات يقترحها النظام وفق علاقاتك الحالية.", emptyTitle: "لا توجد اقتراحات الآن", emptyText: "عند توفر اقتراحات مناسبة ستظهر هنا." },
  { path: "/followers", view: "followers", label: "المتابعون", title: "المتابعون", description: "الأشخاص الذين يتابعون ما تشاركه.", emptyTitle: "لا يوجد متابعون بعد", emptyText: "ستظهر حسابات متابعيك هنا." },
  { path: "/following", view: "following", label: "تتابع", title: "الحسابات التي تتابعها", description: "الحسابات التي اخترت متابعة محتواها.", emptyTitle: "لا تتابع حسابات بعد", emptyText: "اكتشف أشخاصاً وابدأ المتابعة من صفحة الاقتراحات." },
  { path: "/blocked", view: "blocked", label: "الحظر", title: "الحسابات المحظورة", description: "الحسابات التي أوقفت التفاعل معها.", emptyTitle: "لا توجد حسابات محظورة", emptyText: "ستظهر هنا الحسابات التي تحظرها." },
];

function entriesFor(view: RelationshipView, payload: unknown): RelationshipEntry[] {
  if (!Array.isArray(payload)) return [];
  if (view === "friends") return (payload as ApiFriend[]).map(item => ({ id: item.id, user: item.user }));
  if (view === "requests") return (payload as ApiFriendRequest[]).map(item => ({ id: item.id, user: item.requester }));
  if (view === "followers") return (payload as ApiFollow[]).flatMap(item => item.follower ? [{ id: item.id, user: item.follower }] : []);
  if (view === "following") return (payload as ApiFollow[]).flatMap(item => item.followed ? [{ id: item.id, user: item.followed, isFollowing: true }] : []);
  if (view === "blocked") return (payload as ApiBlock[]).map(item => ({ id: item.id, user: item.blocked }));
  return (payload as ApiSuggestion[]).map(item => ({ id: item.id, user: item, mutualCount: item.mutualCount, isFollowing: item.isFollowing, hasPendingFriendRequest: item.hasPendingFriendRequest }));
}

function requestFor(view: RelationshipView): () => Promise<unknown> {
  if (view === "friends") return api.getFriends;
  if (view === "requests") return api.getFriendRequests;
  if (view === "suggestions") return api.getFriendSuggestions;
  if (view === "followers") return api.getFollowers;
  if (view === "following") return api.getFollowing;
  return api.getBlocked;
}

export function LiveRelationshipsPage() {
  const [location, navigate] = useLocation();
  const active = relationshipViews.find(item => item.path === location) ?? relationshipViews[0];
  const { isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const [term, setTerm] = useState("");
  const [followedBack, setFollowedBack] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const listQuery = useQuery({ queryKey: ["rest", "relationships", active.view], queryFn: requestFor(active.view), enabled: isAuthenticated, retry: 1 });
  const entries = useMemo(() => entriesFor(active.view, listQuery.data).filter((entry): entry is RelationshipEntry => Boolean(entry.user) && `${entry.user.displayName} ${entry.user.fullName || ""} ${entry.user.username}`.toLocaleLowerCase("ar").includes(term.trim().toLocaleLowerCase("ar"))), [active.view, listQuery.data, term]);
  const refreshRelationships = async () => { await queryClient.invalidateQueries({ queryKey: ["rest", "relationships"] }); };
  const relationshipAction = useMutation({
    mutationFn: async ({ type, userId, requestId }: { type: "accept" | "decline" | "remove" | "follow" | "unfollow" | "block-unblock" | "request"; userId: string; requestId?: string }) => {
      if (type === "accept" || type === "decline") return api.respondToFriendRequest(requestId!, type);
      if (type === "remove") return api.removeFriend(userId);
      if (type === "follow") return api.followUser(userId);
      if (type === "unfollow") return api.unfollowUser(userId);
      if (type === "block-unblock") return api.unblockUser(userId);
      return api.sendFriendRequest(userId);
    },
    onSuccess: async (_result, action) => {
      if (action.type === "follow") setFollowedBack(previous => ({ ...previous, [action.userId]: true }));
      if (action.type === "unfollow") setFollowedBack(previous => ({ ...previous, [action.userId]: false }));
      await refreshRelationships();
      const notices = { accept: "تم قبول طلب الصداقة", decline: "تم رفض طلب الصداقة", remove: "تمت إزالة الصداقة", follow: "تمت المتابعة", unfollow: "تم إلغاء المتابعة", "block-unblock": "تم إلغاء الحظر", request: "تم إرسال طلب الصداقة" };
      toast.success(notices[action.type]);
    },
    onError: () => toast.error("تعذر تحديث العلاقة، حاول لاحقاً"),
  });
  const startConversation = useMutation({
    mutationFn: api.findOrCreateDirectConversation,
    onSuccess: conversation => {
      void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] });
      navigate(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
    },
    onError: () => toast.error("تعذر فتح المحادثة، حاول لاحقاً"),
  });

  if (isSessionLoading) return <AppShell title="العلاقات"><Surface className="relationship-state"><LoaderCircle className="animate-spin" size={28}/><p>يجري التحقق من جلسة الحساب…</p></Surface></AppShell>;
  if (!isAuthenticated) return <AppShell title="العلاقات"><Surface className="relationship-state"><Users size={28}/><h2>سجّل الدخول لعرض علاقاتك</h2><p>تحتاج قوائم الأصدقاء والمتابعين والطلبات إلى حسابك في يمنا.</p><Link href="/login" className="button">تسجيل الدخول</Link></Surface></AppShell>;

  return <AppShell title={active.title}>
    <div className="relationships-page">
      <Surface className="relationship-intro">
        <div><span className="eyebrow">يمنا · علاقاتك</span><h2>{active.title}</h2><p>{active.description}</p></div>
        <Link href="/people/discover" className="button outline"><UserPlus size={17}/>اكتشاف أشخاص</Link>
      </Surface>
      <nav className="relationship-tabs" aria-label="أقسام العلاقات">
        {relationshipViews.map(item => <Link key={item.path} href={item.path} className={item.view === active.view ? "active" : ""}>{item.label}</Link>)}
      </nav>
      <Surface className="relationship-list">
        <div className="relationship-list-head"><div><h3>{active.title}</h3><p>{listQuery.data ? `${entries.length} نتيجة` : ""}</p></div><SearchBox value={term} onChange={setTerm} placeholder="بحث بالاسم أو اسم المستخدم"/></div>
        {listQuery.isLoading && <div className="relationship-state"><LoaderCircle className="animate-spin" size={26}/><p>يجري تحميل القائمة…</p></div>}
        {listQuery.isError && <div className="relationship-state"><WifiOff size={28}/><h3>تعذر تحميل القائمة</h3><p>تحقق من اتصالك ثم أعد المحاولة.</p><button type="button" className="button outline" onClick={() => listQuery.refetch()}>إعادة المحاولة</button></div>}
        {!listQuery.isLoading && !listQuery.isError && entries.length === 0 && <div className="relationship-state"><Search size={28}/><h3>{term.trim() ? "لا توجد نتيجة مطابقة" : active.emptyTitle}</h3><p>{term.trim() ? "جرّب اسماً أو اسم مستخدم آخر." : active.emptyText}</p></div>}
        {!listQuery.isLoading && !listQuery.isError && entries.map(entry => {
          const person = asPerson(entry.user);
          const canMessage = active.view !== "blocked";
          const followsUser = active.view === "following" || followedBack[entry.user.id] || Boolean(entry.isFollowing);
          const busy = relationshipAction.isPending || startConversation.isPending;
          return <article className="relationship-row" key={entry.id}>
            <Link className="relationship-profile" href={`/profile/${encodeURIComponent(entry.user.username || entry.user.id)}`}><Avatar person={person} size="lg"/><span><strong>{person.name}</strong><small>@{entry.user.username || "مستخدم-يمنا"}</small>{active.view === "suggestions" && <em>{entry.mutualCount || 0} أصدقاء مشتركون</em>}{entry.user.city && <em>{entry.user.city}</em>}</span></Link>
            <div className="relationship-actions">
              {active.view === "requests" && <><button type="button" className="button" disabled={busy} onClick={() => relationshipAction.mutate({ type: "accept", userId: entry.user.id, requestId: entry.id })}><Check size={16}/>تأكيد</button><button type="button" className="button ghost" disabled={busy} onClick={() => relationshipAction.mutate({ type: "decline", userId: entry.user.id, requestId: entry.id })}><X size={16}/>رفض</button></>}
              {active.view === "friends" && <><button type="button" className="button outline" disabled={busy} onClick={() => startConversation.mutate(entry.user.id)}><MessageCircle size={16}/>مراسلة</button><button type="button" className="button ghost" disabled={busy} onClick={() => relationshipAction.mutate({ type: "remove", userId: entry.user.id })}><UserMinus size={16}/>إزالة</button></>}
              {active.view === "followers" && <><button type="button" className={followsUser ? "button secondary" : "button outline"} disabled={busy || followsUser} onClick={() => relationshipAction.mutate({ type: "follow", userId: entry.user.id })}>{followsUser ? <><Check size={16}/>تتابعه</> : <><UserPlus size={16}/>متابعة</>}</button>{canMessage && <button type="button" className="button ghost" disabled={busy} onClick={() => startConversation.mutate(entry.user.id)}><MessageCircle size={16}/>مراسلة</button>}</>}
              {active.view === "following" && <><button type="button" className="button secondary" disabled={busy} onClick={() => relationshipAction.mutate({ type: "unfollow", userId: entry.user.id })}>إلغاء المتابعة</button><button type="button" className="button ghost" disabled={busy} onClick={() => startConversation.mutate(entry.user.id)}><MessageCircle size={16}/>مراسلة</button></>}
              {active.view === "suggestions" && <><button type="button" className={entry.hasPendingFriendRequest ? "button secondary" : "button outline"} disabled={busy || entry.hasPendingFriendRequest} onClick={() => relationshipAction.mutate({ type: "request", userId: entry.user.id })}>{entry.hasPendingFriendRequest ? <><Check size={16}/>طلب معلّق</> : <><UserPlus size={16}/>إضافة صديق</>}</button><button type="button" className={followsUser ? "button secondary" : "button ghost"} disabled={busy || followsUser} onClick={() => relationshipAction.mutate({ type: "follow", userId: entry.user.id })}>{followsUser ? "تتابعه" : "متابعة"}</button></>}
              {active.view === "blocked" && <button type="button" className="button outline" disabled={busy} onClick={() => relationshipAction.mutate({ type: "block-unblock", userId: entry.user.id })}><ShieldOff size={16}/>إلغاء الحظر</button>}
            </div>
          </article>;
        })}
      </Surface>
    </div>
  </AppShell>;
}
