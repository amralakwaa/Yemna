import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Heart, ImagePlus, LoaderCircle, MessageCircle, MoreHorizontal, PhoneCall, Plus, Search, Send, Settings, UserPlus, UserRound, WifiOff, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, Pill, SearchBox, SectionHeading, Surface } from "@/components/yemna/UI";
import { api, asPerson, asRelativeTime, hasRestSession, type ApiNotification, type ApiNotificationType } from "@/lib/api";
import { compressImageForUpload } from "@/lib/media";
import { emitRealtime, type RealtimeConnectionStatus, useRealtimeConnectionStatus, useRealtimeSubscription } from "@/lib/realtime";

function SignInRequired({ title }: { title: string }) {
  return <AppShell title={title}><Surface className="content-placeholder"><WifiOff size={28}/><h3>سجّل الدخول للمتابعة</h3><p>تحتاج إلى حسابك لعرض {title} الخاصة بك.</p><Link href="/login" className="button">تسجيل الدخول</Link></Surface></AppShell>;
}

function ConversationName({ conversation }: { conversation: { title?: string | null; participants: Array<{ user: { id?: string; displayName: string; avatarUrl?: string | null } }> } }) {
  return <>{conversation.title || conversation.participants.map(participant => participant.user.displayName).slice(0, 2).join("، ") || "محادثة"}</>;
}

function RealtimeStatus({ status }: { status: RealtimeConnectionStatus }) {
  const labels: Record<RealtimeConnectionStatus, string> = { connected: "متصل الآن", connecting: "جارٍ الاتصال…", reconnecting: "يعاد الاتصال…", offline: "غير متصل", error: "تعذر الاتصال" };
  return <span className={`realtime-status realtime-status-${status}`} aria-live="polite">{status === "connected" ? <Bell size={13}/> : <WifiOff size={13}/>} {labels[status]}</span>;
}

export function RealtimeMessagesPage() {
  const queryClient = useQueryClient();
  const signedIn = hasRestSession();
  const realtimeStatus = useRealtimeConnectionStatus();
  const [location] = useLocation();
  const requestedConversationId = new URLSearchParams(location.split("?")[1] || "").get("conversation") || undefined;
  const [selectedId, setSelectedId] = useState<string | undefined>(requestedConversationId);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const [typingUserId, setTypingUserId] = useState<string>();
  const me = useQuery({ queryKey: ["rest", "me"], queryFn: api.getMe, enabled: signedIn, staleTime: 60_000 });
  const conversations = useQuery({ queryKey: ["rest", "conversations"], queryFn: api.getConversations, enabled: signedIn });
  useEffect(() => {
    if (requestedConversationId && conversations.data?.some(conversation => conversation.id === requestedConversationId)) setSelectedId(requestedConversationId);
    else if (!selectedId && conversations.data?.[0]) setSelectedId(conversations.data[0].id);
  }, [conversations.data, requestedConversationId, selectedId]);
  const selected = conversations.data?.find(conversation => conversation.id === selectedId);
  const [conversationSearch, setConversationSearch] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const directorySearch = useInfiniteQuery({
    queryKey: ["rest", "message-directory", directoryQuery.trim()],
    queryFn: ({ pageParam }) => api.search(directoryQuery.trim(), "users", pageParam, 30),
    initialPageParam: 1,
    getNextPageParam: page => page.usersNextPage ?? undefined,
    enabled: signedIn && directoryQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const directoryUsers = directorySearch.data?.pages.flatMap(page => page.users) ?? [];
  const openDirect = useMutation({
    mutationFn: (userId: string) => api.findOrCreateDirectConversation(userId),
    onSuccess: conversation => {
      setSelectedId(conversation.id);
      void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] });
      toast.success("تم فتح المحادثة");
    },
    onError: () => toast.error("تعذر فتح المحادثة، حاول مجدداً"),
  });
  const visibleConversations = useMemo(() => conversations.data?.filter(conversation => {
    const label = `${conversation.title || ""} ${conversation.participants.map(participant => participant.user.displayName).join(" ")}`.toLowerCase();
    return label.includes(conversationSearch.trim().toLowerCase());
  }) ?? [], [conversationSearch, conversations.data]);
  const messages = useInfiniteQuery({ queryKey: ["rest", "conversation", selectedId], queryFn: ({ pageParam }) => api.getConversationMessagesPage(selectedId!, pageParam, 30), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.nextCursor ?? undefined, enabled: signedIn && Boolean(selectedId) });
  const messageItems = messages.data?.pages.flatMap(page => page.items) ?? [];
  const send = useMutation({ mutationFn: async () => { let mediaId: string | undefined; if (attachment) mediaId = (await api.uploadMedia(await compressImageForUpload(attachment))).id; try { return await api.sendMessage(selectedId!, text.trim(), mediaId); } catch (error) { if (mediaId) void api.deleteMedia(mediaId).catch(() => undefined); throw error; } }, onSuccess: () => { setText(""); setAttachment(undefined); emitRealtime("typing:stop", { conversationId: selectedId! }); void messages.refetch(); queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] }); }, onError: () => toast.error("تعذر إرسال الرسالة أو الصورة، حاول مجدداً") });
  useEffect(() => {
    if (!selectedId) return;
    void api.markConversationRead(selectedId).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] });
  }, [queryClient, selectedId]);
  useEffect(() => {
    if (!selectedId || (!text.trim() && !attachment)) return;
    const timer = window.setTimeout(() => emitRealtime("typing:stop", { conversationId: selectedId }), 1_200);
    return () => window.clearTimeout(timer);
  }, [attachment, selectedId, text]);
  const onEvent = useCallback((event: { name: string; payload: unknown }) => { const payload = event.payload as { conversationId?: string; userId?: string }; queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] }); if (payload.conversationId === selectedId) { if (event.name === "typing:start") setTypingUserId(payload.userId); else if (event.name === "typing:stop") setTypingUserId(undefined); else void messages.refetch(); } }, [messages, queryClient, selectedId]);
  useRealtimeSubscription(["message:new", "message:read", "typing:start", "typing:stop"], onEvent);

  if (!signedIn) return <SignInRequired title="الرسائل"/>;
  return <AppShell title="الرسائل"><div className="messages-page"><Surface className="conversations"><SectionHeading title="الرسائل" action={<><RealtimeStatus status={realtimeStatus}/><Link href="/messages/new" className="icon-button" aria-label="رسالة جديدة"><Plus size={18}/></Link></>}/><SearchBox value={conversationSearch} onChange={setConversationSearch} placeholder="بحث في الرسائل"/><div className="message-directory"><div className="message-directory-heading"><span><UserRound size={16}/><b>ابدأ محادثة جديدة</b></span><small>ابحث عن أي مستخدم بالاسم أو اسم المستخدم</small></div><div className="message-directory-search"><Search size={16}/><input value={directoryQuery} onChange={event => setDirectoryQuery(event.target.value)} placeholder="ابحث عن مستخدمين…" aria-label="البحث عن مستخدمين"/></div>{directoryQuery.trim().length > 0 && directoryQuery.trim().length < 2 && <small className="directory-hint">اكتب حرفين على الأقل للبحث</small>}{directorySearch.isFetching && <div className="directory-state"><LoaderCircle className="animate-spin"/><span>جارٍ البحث…</span></div>}{directorySearch.isError && <div className="directory-state directory-error"><WifiOff size={15}/><span>تعذر البحث عن المستخدمين</span></div>}{directoryUsers.map(user => <button type="button" className="directory-user" key={user.id} onClick={() => openDirect.mutate(user.id)} disabled={openDirect.isPending}>{<Avatar person={asPerson(user)}/>}<span><b>{user.displayName}</b><small>@{user.username || "مستخدم يمنا"}{user.city ? ` · ${user.city}` : ""}</small></span>{openDirect.isPending ? <LoaderCircle className="animate-spin" size={16}/> : <Plus size={16}/>}</button>)}{directorySearch.hasNextPage && <button type="button" className="directory-more" onClick={() => directorySearch.fetchNextPage()} disabled={directorySearch.isFetchingNextPage}>{directorySearch.isFetchingNextPage ? <LoaderCircle className="animate-spin" size={16}/> : "تحميل مستخدمين إضافيين"}</button>}{directorySearch.data && directoryUsers.length === 0 && directoryQuery.trim().length >= 2 && !directorySearch.isFetching && <div className="directory-state"><UserRound size={16}/><span>لا يوجد مستخدم مطابق</span></div>}</div>{conversations.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}{conversations.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل المحادثات.</p></div>}{visibleConversations.map(conversation => <button type="button" className={selectedId === conversation.id ? "conversation selected" : "conversation"} onClick={() => setSelectedId(conversation.id)} key={conversation.id}>{conversation.participants[0]?.user && <Avatar person={asPerson(conversation.participants[0].user)} /> }<span><b><ConversationName conversation={conversation}/></b><small>{conversation.messages?.[0]?.body || "لا توجد رسائل بعد"}</small></span><span className="conversation-meta"><time>{asRelativeTime(conversation.messages?.[0]?.createdAt)}</time>{Boolean(conversation.unreadCount) && <strong className="unread-badge" aria-label={`${conversation.unreadCount} رسائل غير مقروءة`}>{conversation.unreadCount}</strong>}</span></button>)}{!conversations.isLoading && !conversations.isError && conversations.data?.length === 0 && <div className="content-placeholder"><p>لا توجد محادثات بعد.</p><Link href="/messages/new" className="button">بدء محادثة</Link></div>}{!conversations.isLoading && !conversations.isError && conversations.data && conversations.data.length > 0 && visibleConversations.length === 0 && <div className="content-placeholder"><p>لا توجد محادثات مطابقة.</p></div>}</Surface><Surface className="chat-window">{selected ? <><header><div className="chat-person"><span className="chat-avatar-wrap">{selected.participants[0]?.user && <Avatar person={asPerson(selected.participants[0].user)} />}</span><span><b><ConversationName conversation={selected}/></b><small>{selected.kind === "DIRECT" ? "محادثة خاصة في يمنا" : `${selected.participants.length} مشاركين`}</small></span></div><div className="chat-header-actions"><RealtimeStatus status={realtimeStatus}/><button type="button" className="icon-button" aria-label="خيارات المحادثة"><MoreHorizontal size={19}/></button></div></header><div className="chat-messages">{messages.hasNextPage && <button type="button" className="load-older" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage}>{messages.isFetchingNextPage ? <LoaderCircle className="animate-spin"/> : "تحميل الرسائل السابقة"}</button>}{messages.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}{messages.isError && <div className="content-placeholder"><p>تعذر تحميل الرسائل.</p></div>}{messageItems.map(message => <div className={message.sender.id === me.data?.id ? "bubble sent" : "bubble received"} key={message.id}>{message.media?.map(media => <img className="message-image" src={media.publicUrl} alt="صورة مرفقة" key={media.id}/>)}{message.body && <span>{message.body}</span>}</div>)}{typingUserId && <div className="typing-indicator" aria-live="polite">يكتب الآن…</div>}{!messages.isLoading && messageItems.length === 0 && <div className="content-placeholder"><p>ابدأ المحادثة برسالة مرحبة.</p></div>}</div><div className="chat-input"><input type="file" accept="image/*" className="sr-only" id="message-image" disabled={send.isPending} onChange={event => setAttachment(event.target.files?.[0])}/><label htmlFor="message-image" className="icon-button" aria-label="إرفاق صورة"><ImagePlus size={18}/></label>{attachment && <span className="attachment-chip">{attachment.name}<button type="button" onClick={() => setAttachment(undefined)} aria-label="إزالة الصورة"><X size={14}/></button></span>}<input disabled={send.isPending} value={text} onChange={event => { setText(event.target.value); if (selectedId) emitRealtime("typing:start", { conversationId: selectedId }); }} onKeyDown={event => { if (event.key === "Enter" && (text.trim() || attachment)) send.mutate(); }} placeholder="اكتب رسالة..."/><button type="button" className="send-button" aria-label="إرسال الرسالة" disabled={(!text.trim() && !attachment) || send.isPending} onClick={() => send.mutate()}><Send size={18}/></button></div></> : <div className="content-placeholder"><p>اختر محادثة لعرض رسائلها.</p></div>}</Surface></div></AppShell>;
}

export function RealtimeNotificationsPage() {
  const queryClient = useQueryClient();
  const signedIn = hasRestSession();
  const realtimeStatus = useRealtimeConnectionStatus();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "MESSAGES" | "RELATIONSHIPS" | "POSTS" | "CALLS">("ALL");
  const notifications = useQuery<ApiNotification[]>({ queryKey: ["rest", "notifications", "center"], queryFn: () => api.getNotifications(), enabled: signedIn });
  const unread = useQuery<{ count: number }>({ queryKey: ["rest", "notifications", "unread-count"], queryFn: api.getUnreadNotificationCount, enabled: signedIn, staleTime: 15_000 });
  const refreshNotifications = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] });
  }, [queryClient]);
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: refreshNotifications, onError: () => toast.error("تعذر تعليم الإشعار كمقروء") });
  const markAll = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: refreshNotifications, onError: () => toast.error("تعذر تحديث حالة الإشعارات") });
  const onEvent = refreshNotifications;
  useRealtimeSubscription(["notification:new", "notification:read"], onEvent);
  const matchesFilter = (notification: ApiNotification) => {
    if (filter === "ALL") return true;
    if (filter === "UNREAD") return !notification.readAt;
    if (filter === "MESSAGES") return notification.type === "MESSAGE";
    if (filter === "RELATIONSHIPS") return ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "FOLLOW"].includes(notification.type);
    if (filter === "POSTS") return ["POST_REACTION", "POST_COMMENT", "COMMENT_REPLY"].includes(notification.type);
    return notification.type === "CALL_INVITE";
  };
  const visible = useMemo(() => notifications.data?.filter(matchesFilter) ?? [], [filter, notifications.data]);
  const allNotifications = notifications.data ?? [];
  const totalUnread = unread.data?.count ?? allNotifications.filter(notification => !notification.readAt).length;
  const counters = {
    messages: allNotifications.filter(notification => notification.type === "MESSAGE" && !notification.readAt).length,
    relationships: allNotifications.filter(notification => ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "FOLLOW"].includes(notification.type) && !notification.readAt).length,
    posts: allNotifications.filter(notification => ["POST_REACTION", "POST_COMMENT", "COMMENT_REPLY"].includes(notification.type) && !notification.readAt).length,
    calls: allNotifications.filter(notification => notification.type === "CALL_INVITE" && !notification.readAt).length,
  };
  const openNotification = (notification: ApiNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.linkUrl) navigate(notification.linkUrl);
  };
  if (!signedIn) return <SignInRequired title="الإشعارات"/>;
  return <AppShell title="الإشعارات"><div className="notifications-page"><Surface className="notification-list"><header><div><h1>الإشعارات</h1><small>{totalUnread > 0 ? `${totalUnread} إشعار غير مقروء` : "أنت على اطلاع بكل جديد"}</small></div><span><RealtimeStatus status={realtimeStatus}/><button type="button" className="icon-button" onClick={() => markAll.mutate()} disabled={markAll.isPending || totalUnread === 0} title="تعليم الكل كمقروء" aria-label="تعليم كل الإشعارات كمقروء"><Settings size={19}/></button></span></header><div className="notification-summary" aria-label="ملخص الإشعارات غير المقروءة"><button type="button" onClick={() => setFilter("MESSAGES")}><MessageCircle size={17}/><span>الرسائل</span><b>{counters.messages}</b></button><button type="button" onClick={() => setFilter("RELATIONSHIPS")}><UserPlus size={17}/><span>العلاقات</span><b>{counters.relationships}</b></button><button type="button" onClick={() => setFilter("POSTS")}><Heart size={17}/><span>المنشورات</span><b>{counters.posts}</b></button><button type="button" onClick={() => setFilter("CALLS")}><PhoneCall size={17}/><span>المكالمات</span><b>{counters.calls}</b></button></div><div className="notification-tabs notification-tabs--types"><Pill active={filter === "ALL"} onClick={() => setFilter("ALL")}>الكل</Pill><Pill active={filter === "UNREAD"} onClick={() => setFilter("UNREAD")}>غير المقروءة</Pill><Pill active={filter === "MESSAGES"} onClick={() => setFilter("MESSAGES")}>رسائل</Pill><Pill active={filter === "RELATIONSHIPS"} onClick={() => setFilter("RELATIONSHIPS")}>العلاقات</Pill><Pill active={filter === "POSTS"} onClick={() => setFilter("POSTS")}>المنشورات</Pill><Pill active={filter === "CALLS"} onClick={() => setFilter("CALLS")}>مكالمات</Pill></div>{notifications.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/><p>يجري تحميل الإشعارات…</p></div>}{notifications.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل الإشعارات. تحقق من اتصالك ثم أعد المحاولة.</p></div>}{!notifications.isLoading && !notifications.isError && visible.length === 0 && <div className="content-placeholder"><Bell size={28}/><h3>{filter === "ALL" ? "لا توجد إشعارات" : "لا توجد إشعارات ضمن هذا القسم"}</h3><p>{filter === "ALL" ? "ستظهر الرسائل والعلاقات والتفاعلات والمكالمات هنا فور وصولها." : "جرّب اختيار قسم آخر أو اعرض كل الإشعارات."}</p></div>}{visible.map(notification => <button type="button" className={notification.readAt ? "notification-row" : "notification-row notification-row--unread"} key={notification.id} onClick={() => openNotification(notification)}><NotificationIcon type={notification.type}/><span><b>{notification.actor?.displayName || notification.title}</b> {notification.actor ? notification.title : notification.body}<small>{asRelativeTime(notification.createdAt)}</small></span>{notification.actor && <Avatar person={asPerson(notification.actor)} />}{!notification.readAt && <i className="notice-dot"/>}</button>)}</Surface><aside className="notice-guide"><Surface><Bell size={27}/><h3>كل ما يهمك في مكان واحد</h3><p>تصل إشعارات الرسائل والعلاقات والمنشورات والمكالمات مباشرةً عند اتصالك.</p><Link href="/settings/notifications" className="button">إعدادات الإشعارات</Link></Surface></aside></div></AppShell>;
}

function NotificationIcon({ type }: { type: ApiNotificationType }) {
  if (type === "MESSAGE") return <span className="notification-icon"><MessageCircle size={19}/></span>;
  if (["FRIEND_REQUEST", "FRIEND_ACCEPTED", "FOLLOW"].includes(type)) return <span className="notification-icon"><UserPlus size={19}/></span>;
  if (["POST_REACTION", "POST_COMMENT", "COMMENT_REPLY"].includes(type)) return <span className="notification-icon"><Heart size={19}/></span>;
  if (type === "CALL_INVITE") return <span className="notification-icon"><PhoneCall size={19}/></span>;
  return <span className="notification-icon"><Bell size={19}/></span>;
}
