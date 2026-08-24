import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Check, EyeOff, LoaderCircle, MessageCircle, Search, ShieldOff, UserMinus, UserPlus, Users, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, SearchBox, Surface } from "@/components/yemna/UI";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, asPerson, type ApiBlock, type ApiFollow, type ApiFriend, type ApiFriendRequest, type ApiOutgoingFriendRequest, type ApiSuggestion, type ApiUser } from "@/lib/api";

type RelationshipView = "friends" | "requests" | "outgoing" | "suggestions" | "followers" | "following" | "blocked";
type RelationshipEntry = { id: string; user: ApiUser; mutualCount?: number; isFollowing?: boolean; hasPendingFriendRequest?: boolean };

const relationshipViews: Array<{ path: string; view: RelationshipView; label: string; title: string; description: string; emptyTitle: string; emptyText: string }> = [
  { path: "/friends", view: "friends", label: "الأصدقاء", title: "الأصدقاء", description: "الأشخاص المرتبطون بك في يمنا.", emptyTitle: "لا يوجد أصدقاء بعد", emptyText: "ستظهر صداقاتك المقبولة هنا." },
  { path: "/friend-requests", view: "requests", label: "الواردة", title: "طلبات الصداقة الواردة", description: "راجع الطلبات المرسلة إلى حسابك.", emptyTitle: "لا توجد طلبات واردة", emptyText: "ستظهر طلبات الصداقة الجديدة هنا." },
  { path: "/friend-requests/sent", view: "outgoing", label: "المرسلة", title: "طلبات الصداقة المرسلة", description: "طلبات الصداقة التي تنتظر رد أصحابها.", emptyTitle: "لا توجد طلبات مرسلة", emptyText: "ستظهر هنا الطلبات التي ترسلها إلى الآخرين." },
  { path: "/people/discover", view: "suggestions", label: "الاقتراحات", title: "أشخاص قد تعرفهم", description: "حسابات يقترحها النظام وفق علاقاتك الحالية.", emptyTitle: "لا توجد اقتراحات الآن", emptyText: "عند توفر اقتراحات مناسبة ستظهر هنا." },
  { path: "/followers", view: "followers", label: "المتابعون", title: "المتابعون", description: "الأشخاص الذين يتابعون ما تشاركه.", emptyTitle: "لا يوجد متابعون بعد", emptyText: "ستظهر حسابات متابعيك هنا." },
  { path: "/following", view: "following", label: "تتابع", title: "الحسابات التي تتابعها", description: "الحسابات التي اخترت متابعة محتواها.", emptyTitle: "لا تتابع حسابات بعد", emptyText: "اكتشف أشخاصاً وابدأ المتابعة من صفحة الاقتراحات." },
  { path: "/blocked", view: "blocked", label: "الحظر", title: "الحسابات المحظورة", description: "الحسابات التي أوقفت التفاعل معها.", emptyTitle: "لا توجد حسابات محظورة", emptyText: "ستظهر هنا الحسابات التي تحظرها." },
];

function entriesFor(view: RelationshipView, payload: unknown): RelationshipEntry[] {
  if (!Array.isArray(payload)) return [];
  if (view === "friends") return (payload as ApiFriend[]).map(item => ({ id: item.id, user: item.user }));
  if (view === "requests") return (payload as ApiFriendRequest[]).map(item => ({ id: item.id, user: item.requester }));
  if (view === "outgoing") return (payload as ApiOutgoingFriendRequest[]).map(item => ({ id: item.id, user: item.recipient }));
  if (view === "followers") return (payload as ApiFollow[]).flatMap(item => item.follower ? [{ id: item.id, user: item.follower }] : []);
  if (view === "following") return (payload as ApiFollow[]).flatMap(item => item.followed ? [{ id: item.id, user: item.followed, isFollowing: true }] : []);
  if (view === "blocked") return (payload as ApiBlock[]).map(item => ({ id: item.id, user: item.blocked }));
  return (payload as ApiSuggestion[]).map(item => ({ id: item.id, user: item, mutualCount: item.mutualCount, isFollowing: item.isFollowing, hasPendingFriendRequest: item.hasPendingFriendRequest }));
}

function requestFor(view: RelationshipView): () => Promise<unknown> {
  if (view === "friends") return api.getFriends;
  if (view === "requests") return api.getFriendRequests;
  if (view === "outgoing") return api.getOutgoingFriendRequests;
  if (view === "suggestions") return api.getFriendSuggestions;
  if (view === "followers") return api.getFollowers;
  if (view === "following") return api.getFollowing;
  return api.getBlocked;
}

function mutualFriendsText(count: number) {
  if (count === 1) return "صديق مشترك واحد";
  if (count === 2) return "صديقان مشتركان";
  if (count >= 3 && count <= 10) return `${count} أصدقاء مشتركون`;
  return `${count} صديقاً مشتركاً`;
}

export function LiveRelationshipsPage() {
  const [location, navigate] = useLocation();
  const active = relationshipViews.find(item => item.path === location) ?? (location === "/blocked/unblock" ? relationshipViews.find(item => item.view === "blocked")! : relationshipViews[0]);
  const { isAuthenticated, isLoading: isSessionLoading } = useCurrentUser();
  const [term, setTerm] = useState("");
  const [followedBack, setFollowedBack] = useState<Record<string, boolean>>({});
  const [mutualTarget, setMutualTarget] = useState<ApiUser | null>(null);
  const queryClient = useQueryClient();
  const listQuery = useQuery({ queryKey: ["rest", "relationships", active.view], queryFn: requestFor(active.view), enabled: isAuthenticated, retry: 1 });
  const mutualFriendsQuery = useQuery({ queryKey: ["rest", "relationships", "mutual", mutualTarget?.id], queryFn: () => api.getMutualFriends(mutualTarget!.id), enabled: Boolean(mutualTarget), retry: 1 });
  const entries = useMemo(() => entriesFor(active.view, listQuery.data).filter((entry): entry is RelationshipEntry => Boolean(entry.user) && `${entry.user.displayName} ${entry.user.fullName || ""} ${entry.user.username}`.toLocaleLowerCase("ar").includes(term.trim().toLocaleLowerCase("ar"))), [active.view, listQuery.data, term]);
  const refreshRelationships = async () => { await queryClient.invalidateQueries({ queryKey: ["rest", "relationships"] }); };
  const relationshipAction = useMutation({
    mutationFn: async ({ type, userId, requestId }: { type: "accept" | "decline" | "remove" | "follow" | "unfollow" | "block-unblock" | "request" | "cancel-request" | "dismiss-suggestion"; userId: string; requestId?: string }) => {
      if (type === "accept" || type === "decline") return api.respondToFriendRequest(requestId!, type);
      if (type === "cancel-request") return api.cancelOutgoingFriendRequest(requestId!);
      if (type === "dismiss-suggestion") return api.dismissFriendSuggestion(userId);
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
      const notices = { accept: "تم قبول طلب الصداقة", decline: "تم رفض طلب الصداقة", remove: "تمت إزالة الصداقة", follow: "تمت المتابعة", unfollow: "تم إلغاء المتابعة", "block-unblock": "تم إلغاء الحظر", request: "تم إرسال طلب الصداقة", "cancel-request": "تم إلغاء طلب الصداقة", "dismiss-suggestion": "تم إخفاء الاقتراح" };
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
          const suggestionReason = entry.mutualCount && entry.mutualCount > 0 ? mutualFriendsText(entry.mutualCount) : "اقتراح مبني على علاقاتك في يمنا";
          return <article className={`relationship-row${active.view === "suggestions" ? " relationship-suggestion-row" : ""}`} key={entry.id}>
            <div className="relationship-person">
              <Link className="relationship-profile" href={`/profile/${encodeURIComponent(entry.user.username || entry.user.id)}`}><Avatar person={person} size="lg"/><span><strong>{person.name}</strong><small>@{entry.user.username || "مستخدم-يمنا"}</small>{entry.user.city && <em>{entry.user.city}</em>}</span></Link>
              {active.view === "suggestions" && (entry.mutualCount && entry.mutualCount > 0 ? <button type="button" className="relationship-suggestion-reason" onClick={() => setMutualTarget(entry.user)}><Users size={14}/>{suggestionReason}</button> : <span className="relationship-suggestion-reason"><Users size={14}/>{suggestionReason}</span>)}
            </div>
            <div className="relationship-actions">
              {active.view === "requests" && <><button type="button" className="button" disabled={busy} onClick={() => relationshipAction.mutate({ type: "accept", userId: entry.user.id, requestId: entry.id })}><Check size={16}/>تأكيد</button><button type="button" className="button ghost" disabled={busy} onClick={() => relationshipAction.mutate({ type: "decline", userId: entry.user.id, requestId: entry.id })}><X size={16}/>رفض</button></>}
              {active.view === "outgoing" && <button type="button" className="button ghost" disabled={busy} onClick={() => relationshipAction.mutate({ type: "cancel-request", userId: entry.user.id, requestId: entry.id })}><X size={16}/>إلغاء الطلب</button>}
              {active.view === "friends" && <><button type="button" className="button outline" disabled={busy} onClick={() => startConversation.mutate(entry.user.id)}><MessageCircle size={16}/>مراسلة</button><button type="button" className="button ghost" disabled={busy} onClick={() => relationshipAction.mutate({ type: "remove", userId: entry.user.id })}><UserMinus size={16}/>إزالة</button></>}
              {active.view === "followers" && <><button type="button" className={followsUser ? "button secondary" : "button outline"} disabled={busy || followsUser} onClick={() => relationshipAction.mutate({ type: "follow", userId: entry.user.id })}>{followsUser ? <><Check size={16}/>تتابعه</> : <><UserPlus size={16}/>متابعة</>}</button>{canMessage && <button type="button" className="button ghost" disabled={busy} onClick={() => startConversation.mutate(entry.user.id)}><MessageCircle size={16}/>مراسلة</button>}</>}
              {active.view === "following" && <><button type="button" className="button secondary" disabled={busy} onClick={() => relationshipAction.mutate({ type: "unfollow", userId: entry.user.id })}>إلغاء المتابعة</button><button type="button" className="button ghost" disabled={busy} onClick={() => startConversation.mutate(entry.user.id)}><MessageCircle size={16}/>مراسلة</button></>}
              {active.view === "suggestions" && <><button type="button" className={entry.hasPendingFriendRequest ? "button secondary" : "button"} disabled={busy || entry.hasPendingFriendRequest} onClick={() => relationshipAction.mutate({ type: "request", userId: entry.user.id })}>{entry.hasPendingFriendRequest ? <><Check size={16}/>طلب معلّق</> : <><UserPlus size={16}/>إضافة صديق</>}</button><button type="button" className={followsUser ? "button secondary" : "button ghost"} disabled={busy || followsUser} onClick={() => relationshipAction.mutate({ type: "follow", userId: entry.user.id })}>{followsUser ? "تتابعه" : "متابعة"}</button><button type="button" className="button ghost" disabled={busy} onClick={() => relationshipAction.mutate({ type: "dismiss-suggestion", userId: entry.user.id })}><EyeOff size={16}/>تجاهل</button></>}
              {active.view === "blocked" && <button type="button" className="button outline" disabled={busy} onClick={() => relationshipAction.mutate({ type: "block-unblock", userId: entry.user.id })}><ShieldOff size={16}/>إلغاء الحظر</button>}
            </div>
          </article>;
        })}
      </Surface>
      <Dialog open={Boolean(mutualTarget)} onOpenChange={open => { if (!open) setMutualTarget(null); }}>
        <DialogContent dir="rtl" className="mutual-friends-dialog" showCloseButton={false}>
          <DialogHeader className="mutual-friends-dialog-head">
            <DialogTitle>الأصدقاء المشتركون</DialogTitle>
            <DialogDescription>{mutualTarget ? `الأصدقاء الذين تربطهم صداقة مقبولة بك وبـ ${asPerson(mutualTarget).name}.` : ""}</DialogDescription>
          </DialogHeader>
          <div className="mutual-friends-dialog-body">
            {mutualFriendsQuery.isLoading && <div className="relationship-state"><LoaderCircle className="animate-spin" size={25}/><p>يجري تحميل الأصدقاء المشتركين…</p></div>}
            {mutualFriendsQuery.isError && <div className="relationship-state"><WifiOff size={26}/><h3>تعذر تحميل الأصدقاء المشتركين</h3><p>تحقق من اتصالك ثم أعد المحاولة.</p><button type="button" className="button outline" onClick={() => mutualFriendsQuery.refetch()}>إعادة المحاولة</button></div>}
            {!mutualFriendsQuery.isLoading && !mutualFriendsQuery.isError && mutualFriendsQuery.data?.length === 0 && <div className="relationship-state"><Users size={27}/><h3>لا يوجد أصدقاء مشتركون الآن</h3><p>تتغير هذه القائمة وفق الصداقات المقبولة الحالية فقط.</p></div>}
            {!mutualFriendsQuery.isLoading && !mutualFriendsQuery.isError && mutualFriendsQuery.data?.map(mutualFriend => {
              const mutualPerson = asPerson(mutualFriend);
              return <Link key={mutualFriend.id} href={`/profile/${encodeURIComponent(mutualFriend.username || mutualFriend.id)}`} className="mutual-friend-row" onClick={() => setMutualTarget(null)}><Avatar person={mutualPerson} size="md"/><span><strong>{mutualPerson.name}</strong><small>@{mutualFriend.username || "مستخدم-يمنا"}</small></span></Link>;
            })}
          </div>
          <div className="mutual-friends-dialog-footer"><DialogClose className="button outline">إغلاق</DialogClose></div>
        </DialogContent>
      </Dialog>
    </div>
  </AppShell>;
}
