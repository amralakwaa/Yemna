import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ImagePlus, LoaderCircle, MoreHorizontal, Plus, Send, Settings, WifiOff, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, Pill, SearchBox, SectionHeading, Surface } from "@/components/yemna/UI";
import { api, asPerson, asRelativeTime, hasRestSession } from "@/lib/api";
import { compressImageForUpload } from "@/lib/media";
import { emitRealtime, type RealtimeConnectionStatus, useRealtimeConnectionStatus, useRealtimeSubscription } from "@/lib/realtime";

function SignInRequired({ title }: { title: string }) {
  return <AppShell title={title}><Surface className="content-placeholder"><WifiOff size={28}/><h3>سجّل الدخول للمتابعة</h3><p>تحتاج إلى حسابك لعرض {title} الخاصة بك.</p><Link href="/login" className="button">تسجيل الدخول</Link></Surface></AppShell>;
}

function ConversationName({ conversation }: { conversation: { title?: string | null; participants: Array<{ user: { displayName: string } }> } }) {
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
  return <AppShell title="الرسائل"><div className="messages-page"><Surface className="conversations"><SectionHeading title="الرسائل" action={<><RealtimeStatus status={realtimeStatus}/><Link href="/messages/new" className="icon-button" aria-label="رسالة جديدة"><Plus size={18}/></Link></>}/><SearchBox value={conversationSearch} onChange={setConversationSearch} placeholder="بحث في الرسائل"/>{conversations.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}{conversations.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل المحادثات.</p></div>}{visibleConversations.map(conversation => <button type="button" className={selectedId === conversation.id ? "conversation selected" : "conversation"} onClick={() => setSelectedId(conversation.id)} key={conversation.id}><span><b><ConversationName conversation={conversation}/></b><small>{conversation.messages?.[0]?.body || "لا توجد رسائل بعد"}</small></span><span className="conversation-meta"><time>{asRelativeTime(conversation.messages?.[0]?.createdAt)}</time>{Boolean(conversation.unreadCount) && <strong className="unread-badge" aria-label={`${conversation.unreadCount} رسائل غير مقروءة`}>{conversation.unreadCount}</strong>}</span></button>)}{!conversations.isLoading && !conversations.isError && conversations.data?.length === 0 && <div className="content-placeholder"><p>لا توجد محادثات بعد.</p><Link href="/messages/new" className="button">بدء محادثة</Link></div>}{!conversations.isLoading && !conversations.isError && conversations.data && conversations.data.length > 0 && visibleConversations.length === 0 && <div className="content-placeholder"><p>لا توجد محادثات مطابقة.</p></div>}</Surface><Surface className="chat-window">{selected ? <><header><div><span><b><ConversationName conversation={selected}/></b><small>{selected.kind === "DIRECT" ? "محادثة خاصة في يمنا" : "محادثة جماعية في يمنا"}</small></span></div><button type="button" className="icon-button"><MoreHorizontal size={19}/></button></header><div className="chat-messages">{messages.hasNextPage && <button type="button" className="load-older" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage}>{messages.isFetchingNextPage ? <LoaderCircle className="animate-spin"/> : "تحميل الرسائل السابقة"}</button>}{messages.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}{messages.isError && <div className="content-placeholder"><p>تعذر تحميل الرسائل.</p></div>}{messageItems.map(message => <div className={message.sender.id === me.data?.id ? "bubble sent" : "bubble received"} key={message.id}>{message.media?.map(media => <img className="message-image" src={media.publicUrl} alt="صورة مرفقة" key={media.id}/>)}{message.body && <span>{message.body}</span>}</div>)}{typingUserId && <div className="typing-indicator" aria-live="polite">يكتب الآن…</div>}{!messages.isLoading && messageItems.length === 0 && <div className="content-placeholder"><p>ابدأ المحادثة برسالة مرحبة.</p></div>}</div><div className="chat-input"><input type="file" accept="image/*" className="sr-only" id="message-image" disabled={send.isPending} onChange={event => setAttachment(event.target.files?.[0])}/><label htmlFor="message-image" className="icon-button" aria-label="إرفاق صورة"><ImagePlus size={18}/></label>{attachment && <span className="attachment-chip">{attachment.name}<button type="button" onClick={() => setAttachment(undefined)} aria-label="إزالة الصورة"><X size={14}/></button></span>}<input disabled={send.isPending} value={text} onChange={event => { setText(event.target.value); if (selectedId) emitRealtime("typing:start", { conversationId: selectedId }); }} onKeyDown={event => { if (event.key === "Enter" && (text.trim() || attachment)) send.mutate(); }} placeholder="اكتب رسالة..."/><button type="button" className="send-button" aria-label="إرسال الرسالة" disabled={(!text.trim() && !attachment) || send.isPending} onClick={() => send.mutate()}><Send size={18}/></button></div></> : <div className="content-placeholder"><p>اختر محادثة لعرض رسائلها.</p></div>}</Surface></div></AppShell>;
}

export function RealtimeNotificationsPage() {
  const queryClient = useQueryClient();
  const signedIn = hasRestSession();
  const realtimeStatus = useRealtimeConnectionStatus();
  const [all, setAll] = useState(true);
  const notifications = useQuery({ queryKey: ["rest", "notifications"], queryFn: api.getNotifications, enabled: signedIn });
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }) });
  const markAll = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }) });
  const onEvent = useCallback(() => queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }), [queryClient]);
  useRealtimeSubscription(["notification:new", "notification:read"], onEvent);
  const visible = useMemo(() => notifications.data?.filter(notification => all || !notification.readAt) ?? [], [all, notifications.data]);
  if (!signedIn) return <SignInRequired title="الإشعارات"/>;
  return <AppShell title="الإشعارات"><div className="notifications-page"><Surface className="notification-list"><header><h1>الإشعارات</h1><span><RealtimeStatus status={realtimeStatus}/><button type="button" className="icon-button" onClick={() => markAll.mutate()} disabled={markAll.isPending} title="تعليم الكل كمقروء"><Settings size={19}/></button></span></header><div className="notification-tabs"><Pill active={all} onClick={() => setAll(true)}>الكل</Pill><Pill active={!all} onClick={() => setAll(false)}>غير المقروءة</Pill></div>{notifications.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/><p>يجري تحميل الإشعارات…</p></div>}{notifications.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل الإشعارات.</p></div>}{!notifications.isLoading && !notifications.isError && visible.length === 0 && <div className="content-placeholder"><Bell size={28}/><h3>لا توجد إشعارات</h3><p>ستظهر تفاعلات مجتمعك هنا فور وصولها.</p></div>}{visible.map(notification => <button type="button" className="notification-row" key={notification.id} onClick={() => { if (!notification.readAt) markRead.mutate(notification.id); if (notification.linkUrl) window.location.assign(notification.linkUrl); }}><span className="notification-icon"><Bell size={19}/></span><span><b>{notification.actor?.displayName || notification.title}</b> {notification.actor ? notification.title : notification.body}<small>{asRelativeTime(notification.createdAt)}</small></span>{notification.actor && <Avatar person={asPerson(notification.actor)} />}{!notification.readAt && <i className="notice-dot"/>}</button>)}</Surface><aside className="notice-guide"><Surface><Bell size={27}/><h3>تحكم بما يهمك</h3><p>تصل الإشعارات الجديدة مباشرةً عندما تكون متصلاً.</p><Link href="/settings/notifications" className="button">إعدادات الإشعارات</Link></Surface></aside></div></AppShell>;
}
