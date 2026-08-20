import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LoaderCircle, MoreHorizontal, Plus, Send, Settings, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, Pill, SearchBox, SectionHeading, Surface } from "@/components/yemna/UI";
import { api, asPerson, asRelativeTime, hasRestSession } from "@/lib/api";
import { useRealtimeSubscription } from "@/lib/realtime";

function SignInRequired({ title }: { title: string }) {
  return <AppShell title={title}><Surface className="content-placeholder"><WifiOff size={28}/><h3>سجّل الدخول للمتابعة</h3><p>تحتاج إلى حسابك لعرض {title} الخاصة بك.</p><Link href="/login" className="button">تسجيل الدخول</Link></Surface></AppShell>;
}

function ConversationName({ conversation }: { conversation: { title?: string | null; participants: Array<{ user: { displayName: string } }> } }) {
  return <>{conversation.title || conversation.participants.map(participant => participant.user.displayName).slice(0, 2).join("، ") || "محادثة"}</>;
}

export function RealtimeMessagesPage() {
  const queryClient = useQueryClient();
  const signedIn = hasRestSession();
  const [selectedId, setSelectedId] = useState<string>();
  const [text, setText] = useState("");
  const me = useQuery({ queryKey: ["rest", "me"], queryFn: api.getMe, enabled: signedIn, staleTime: 60_000 });
  const conversations = useQuery({ queryKey: ["rest", "conversations"], queryFn: api.getConversations, enabled: signedIn });
  useEffect(() => { if (!selectedId && conversations.data?.[0]) setSelectedId(conversations.data[0].id); }, [conversations.data, selectedId]);
  const selected = conversations.data?.find(conversation => conversation.id === selectedId);
  const messages = useQuery({ queryKey: ["rest", "conversation", selectedId], queryFn: () => api.getConversationMessages(selectedId!), enabled: signedIn && Boolean(selectedId) });
  const send = useMutation({ mutationFn: () => api.sendMessage(selectedId!, text.trim()), onSuccess: () => { setText(""); queryClient.invalidateQueries({ queryKey: ["rest", "conversation", selectedId] }); queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] }); }, onError: () => toast.error("تعذر إرسال الرسالة، حاول مجدداً") });
  useEffect(() => { if (selectedId) void api.markConversationRead(selectedId).catch(() => undefined); }, [selectedId]);
  const onEvent = useCallback((event: { payload: unknown }) => { const payload = event.payload as { conversationId?: string }; queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] }); if (payload.conversationId === selectedId) queryClient.invalidateQueries({ queryKey: ["rest", "conversation", selectedId] }); }, [queryClient, selectedId]);
  useRealtimeSubscription(["message:new"], onEvent);

  if (!signedIn) return <SignInRequired title="الرسائل"/>;
  return <AppShell title="الرسائل"><div className="messages-page"><Surface className="conversations"><SectionHeading title="الرسائل" action={<button type="button" onClick={() => toast.info("ابدأ محادثة من ملف المستخدم") }><Plus size={18}/></button>}/><SearchBox placeholder="بحث في الرسائل"/>{conversations.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}{conversations.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل المحادثات.</p></div>}{conversations.data?.map(conversation => <button type="button" className={selectedId === conversation.id ? "conversation selected" : "conversation"} onClick={() => setSelectedId(conversation.id)} key={conversation.id}><span><b><ConversationName conversation={conversation}/></b><small>{conversation.messages?.[0]?.body || "لا توجد رسائل بعد"}</small></span><time>{asRelativeTime(conversation.messages?.[0]?.createdAt)}</time></button>)}{!conversations.isLoading && !conversations.isError && conversations.data?.length === 0 && <div className="content-placeholder"><p>لا توجد محادثات بعد.</p></div>}</Surface><Surface className="chat-window">{selected ? <><header><div><span><b><ConversationName conversation={selected}/></b><small>محادثة خاصة في يمنا</small></span></div><button type="button" className="icon-button"><MoreHorizontal size={19}/></button></header><div className="chat-messages">{messages.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}{messages.isError && <div className="content-placeholder"><p>تعذر تحميل الرسائل.</p></div>}{messages.data?.map(message => <div className={message.sender.id === me.data?.id ? "bubble sent" : "bubble received"} key={message.id}>{message.body}</div>)}{!messages.isLoading && messages.data?.length === 0 && <div className="content-placeholder"><p>ابدأ المحادثة برسالة مرحبة.</p></div>}</div><label className="chat-input"><input disabled={send.isPending} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && text.trim()) send.mutate(); }} placeholder="اكتب رسالة..."/><button type="button" className="send-button" disabled={!text.trim() || send.isPending} onClick={() => send.mutate()}><Send size={18}/></button></label></> : <div className="content-placeholder"><p>اختر محادثة لعرض رسائلها.</p></div>}</Surface></div></AppShell>;
}

export function RealtimeNotificationsPage() {
  const queryClient = useQueryClient();
  const signedIn = hasRestSession();
  const [all, setAll] = useState(true);
  const notifications = useQuery({ queryKey: ["rest", "notifications"], queryFn: api.getNotifications, enabled: signedIn });
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }) });
  const markAll = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }) });
  const onEvent = useCallback(() => queryClient.invalidateQueries({ queryKey: ["rest", "notifications"] }), [queryClient]);
  useRealtimeSubscription(["notification:new", "notification:read"], onEvent);
  const visible = useMemo(() => notifications.data?.filter(notification => all || !notification.readAt) ?? [], [all, notifications.data]);
  if (!signedIn) return <SignInRequired title="الإشعارات"/>;
  return <AppShell title="الإشعارات"><div className="notifications-page"><Surface className="notification-list"><header><h1>الإشعارات</h1><button type="button" className="icon-button" onClick={() => markAll.mutate()} disabled={markAll.isPending} title="تعليم الكل كمقروء"><Settings size={19}/></button></header><div className="notification-tabs"><Pill active={all} onClick={() => setAll(true)}>الكل</Pill><Pill active={!all} onClick={() => setAll(false)}>غير المقروءة</Pill></div>{notifications.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/><p>يجري تحميل الإشعارات…</p></div>}{notifications.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل الإشعارات.</p></div>}{!notifications.isLoading && !notifications.isError && visible.length === 0 && <div className="content-placeholder"><Bell size={28}/><h3>لا توجد إشعارات</h3><p>ستظهر تفاعلات مجتمعك هنا فور وصولها.</p></div>}{visible.map(notification => <button type="button" className="notification-row" key={notification.id} onClick={() => { if (!notification.readAt) markRead.mutate(notification.id); if (notification.linkUrl) window.location.assign(notification.linkUrl); }}><span className="notification-icon"><Bell size={19}/></span><span><b>{notification.actor?.displayName || notification.title}</b> {notification.actor ? notification.title : notification.body}<small>{asRelativeTime(notification.createdAt)}</small></span>{notification.actor && <Avatar person={asPerson(notification.actor)} />}{!notification.readAt && <i className="notice-dot"/>}</button>)}</Surface><aside className="notice-guide"><Surface><Bell size={27}/><h3>تحكم بما يهمك</h3><p>تصل الإشعارات الجديدة مباشرةً عندما تكون متصلاً.</p><Link href="/settings/notifications" className="button">إعدادات الإشعارات</Link></Surface></aside></div></AppShell>;
}
