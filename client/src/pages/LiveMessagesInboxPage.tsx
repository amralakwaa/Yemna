import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ImagePlus, LoaderCircle, MessageCircle, Plus, Search, Send, WifiOff, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, SearchBox, Surface } from "@/components/yemna/UI";
import { api, asPerson, asRelativeTime, hasRestSession, type ApiConversation } from "@/lib/api";
import { compressImageForUpload } from "@/lib/media";
import { useRealtimeSubscription } from "@/lib/realtime";

type InboxFilter = "all" | "unread";

function conversationTitle(conversation: ApiConversation, currentUserId?: string) {
  if (conversation.title) return conversation.title;
  const names = conversation.participants
    .filter(participant => participant.user.id !== currentUserId)
    .map(participant => participant.user.displayName)
    .slice(0, 2);
  return names.join("، ") || "محادثة";
}

function conversationPerson(conversation: ApiConversation, currentUserId?: string) {
  return conversation.participants.find(participant => participant.user.id !== currentUserId)?.user
    ?? conversation.participants[0]?.user;
}

function messagePreview(conversation: ApiConversation) {
  const latest = conversation.messages?.[0];
  if (!latest) return "لا توجد رسائل بعد";
  if (latest.body) return latest.body;
  if (latest.media?.length) return "صورة";
  return "رسالة جديدة";
}

function SignInRequired() {
  return <AppShell title="الرسائل"><Surface className="content-placeholder"><WifiOff size={28}/><h3>سجّل الدخول للمتابعة</h3><p>تحتاج إلى حسابك لعرض رسائلك الخاصة.</p><Link href="/login" className="button">تسجيل الدخول</Link></Surface></AppShell>;
}

export function LiveMessagesInboxPage() {
  const signedIn = hasRestSession();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const requestedConversationId = new URLSearchParams(location.split("?")[1] || "").get("conversation") || undefined;
  const [selectedId, setSelectedId] = useState<string | undefined>(requestedConversationId);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(Boolean(requestedConversationId));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const me = useQuery({ queryKey: ["rest", "me"], queryFn: api.getMe, enabled: signedIn, staleTime: 60_000 });
  const conversations = useQuery({ queryKey: ["rest", "conversations"], queryFn: api.getConversations, enabled: signedIn, refetchOnWindowFocus: true });

  useEffect(() => {
    if (requestedConversationId && conversations.data?.some(conversation => conversation.id === requestedConversationId)) {
      setSelectedId(requestedConversationId);
      setMobileConversationOpen(true);
    } else if (!selectedId && conversations.data?.[0]) {
      setSelectedId(conversations.data[0].id);
    }
  }, [conversations.data, requestedConversationId, selectedId]);

  const selected = conversations.data?.find(conversation => conversation.id === selectedId);
  const visibleConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ar");
    return (conversations.data ?? []).filter(conversation => {
      const title = conversationTitle(conversation, me.data?.id);
      const participantNames = conversation.participants.map(participant => participant.user.displayName).join(" ");
      const matchesSearch = !normalizedSearch || `${title} ${participantNames} ${messagePreview(conversation)}`.toLocaleLowerCase("ar").includes(normalizedSearch);
      const matchesFilter = filter === "all" || Boolean(conversation.unreadCount);
      return matchesSearch && matchesFilter;
    });
  }, [conversations.data, filter, me.data?.id, search]);
  const unreadCount = useMemo(() => (conversations.data ?? []).reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0), [conversations.data]);

  const messages = useInfiniteQuery({
    queryKey: ["rest", "conversation", selectedId],
    queryFn: ({ pageParam }) => api.getConversationMessagesPage(selectedId!, pageParam, 30),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: signedIn && Boolean(selectedId),
  });
  const messageItems = messages.data?.pages.flatMap(page => page.items) ?? [];

  const send = useMutation({
    mutationFn: async () => {
      let mediaId: string | undefined;
      if (attachment) mediaId = (await api.uploadMedia(await compressImageForUpload(attachment))).id;
      try {
        return await api.sendMessage(selectedId!, text.trim(), mediaId);
      } catch (error) {
        if (mediaId) void api.deleteMedia(mediaId).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: () => {
      setText("");
      setAttachment(undefined);
      void messages.refetch();
      void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] });
    },
    onError: () => toast.error("تعذر إرسال الرسالة أو الصورة، حاول مجدداً"),
  });

  useEffect(() => {
    if (!selectedId) return;
    void api.markConversationRead(selectedId).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] });
  }, [queryClient, selectedId]);

  const onRealtimeEvent = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["rest", "conversations"] });
    if (selectedId) void messages.refetch();
  }, [messages, queryClient, selectedId]);
  useRealtimeSubscription(["message:new", "message:read"], onRealtimeEvent);

  const openConversation = (conversationId: string) => {
    setSelectedId(conversationId);
    setMobileConversationOpen(true);
    setLocation(`/messages?conversation=${encodeURIComponent(conversationId)}`);
  };
  const closeMobileConversation = () => {
    setMobileConversationOpen(false);
    setSelectedId(undefined);
    setLocation("/messages", { replace: true });
  };

  if (!signedIn) return <SignInRequired/>;

  const selectedPerson = selected ? conversationPerson(selected, me.data?.id) : undefined;
  return <AppShell title="الرسائل"><div className={`social-inbox${mobileConversationOpen ? " mobile-chat-open" : ""}`}>
    <Surface className="social-inbox-list" aria-label="قائمة المحادثات">
      <header className="social-inbox-heading"><div><h1>الرسائل</h1><p>{conversations.data ? `${conversations.data.length} محادثة` : "محادثاتك الخاصة"}</p></div><Link href="/messages/new" className="icon-button" aria-label="بدء رسالة جديدة"><Plus size={19}/></Link></header>
      <SearchBox value={search} onChange={setSearch} placeholder="ابحث في الرسائل"/>
      <div className="social-inbox-tabs" role="tablist" aria-label="تصفية المحادثات">
        <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>الكل</button>
        <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>غير المقروءة{unreadCount > 0 && <strong>{unreadCount}</strong>}</button>
      </div>
      <div className="social-inbox-list-content" aria-live="polite">
        {conversations.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/><p>يجري تحميل محادثاتك…</p></div>}
        {conversations.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل المحادثات.</p><button type="button" className="button secondary" onClick={() => conversations.refetch()}>إعادة المحاولة</button></div>}
        {!conversations.isLoading && !conversations.isError && visibleConversations.map(conversation => {
          const person = conversationPerson(conversation, me.data?.id);
          const latest = conversation.messages?.[0];
          const unread = Boolean(conversation.unreadCount);
          return <button type="button" className={`social-conversation${selectedId === conversation.id ? " selected" : ""}${unread ? " unread" : ""}`} key={conversation.id} onClick={() => openConversation(conversation.id)}>
            {person && <Avatar person={asPerson(person)}/>}<span className="social-conversation-copy"><b>{conversationTitle(conversation, me.data?.id)}</b><small>{messagePreview(conversation)}</small></span><span className="social-conversation-meta"><time>{asRelativeTime(latest?.createdAt)}</time>{unread && <strong aria-label={`${conversation.unreadCount} رسائل غير مقروءة`}>{conversation.unreadCount}</strong>}</span>
          </button>;
        })}
        {!conversations.isLoading && !conversations.isError && conversations.data?.length === 0 && <div className="content-placeholder"><MessageCircle size={30}/><h3>لا توجد رسائل بعد</h3><p>ابدأ محادثة لتظهر هنا.</p><Link href="/messages/new" className="button">رسالة جديدة</Link></div>}
        {!conversations.isLoading && !conversations.isError && conversations.data && conversations.data.length > 0 && visibleConversations.length === 0 && <div className="content-placeholder"><Search size={27}/><h3>لا توجد محادثات مطابقة</h3><p>{filter === "unread" ? "ليس لديك رسائل غير مقروءة الآن." : "جرّب كلمات بحث أخرى."}</p></div>}
      </div>
    </Surface>
    <Surface className="social-inbox-chat" aria-label="المحادثة الحالية">
      {selected ? <>
        <header className="social-chat-header"><button type="button" className="social-back-button" onClick={closeMobileConversation} aria-label="العودة إلى قائمة الرسائل"><ArrowRight size={20}/><span>الرسائل</span></button>{selectedPerson && <Avatar person={asPerson(selectedPerson)}/>}<span>{selectedPerson?.username ? <Link href={`/profile/${encodeURIComponent(selectedPerson.username)}`}>{conversationTitle(selected, me.data?.id)}</Link> : <b>{conversationTitle(selected, me.data?.id)}</b>}<small>{selected.kind === "DIRECT" ? "محادثة خاصة" : `${selected.participants.length} مشاركين`}</small></span></header>
        <div className="social-chat-messages">
          {messages.hasNextPage && <button type="button" className="load-older" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage}>{messages.isFetchingNextPage ? <LoaderCircle className="animate-spin"/> : "تحميل رسائل سابقة"}</button>}
          {messages.isLoading && <div className="content-placeholder"><LoaderCircle className="animate-spin"/></div>}
          {messages.isError && <div className="content-placeholder"><WifiOff/><p>تعذر تحميل الرسائل.</p><button type="button" className="button secondary" onClick={() => messages.refetch()}>إعادة المحاولة</button></div>}
          {!messages.isLoading && !messages.isError && messageItems.length === 0 && <div className="content-placeholder"><MessageCircle size={28}/><p>ابدأ المحادثة برسالة مرحبة.</p></div>}
          {messageItems.map(message => <div className={message.sender.id === me.data?.id ? "social-message mine" : "social-message"} key={message.id}>{message.media?.map(media => <img src={media.publicUrl} alt="صورة مرفقة" key={media.id}/>)}{message.body && <span>{message.body}</span>}</div>)}
        </div>
        <div className="social-chat-input"><input type="file" accept="image/*" id="social-message-attachment" className="sr-only" disabled={send.isPending} onChange={event => setAttachment(event.target.files?.[0])}/><label htmlFor="social-message-attachment" className="icon-button" aria-label="إرفاق صورة"><ImagePlus size={19}/></label>{attachment && <span className="attachment-chip">{attachment.name}<button type="button" onClick={() => setAttachment(undefined)} aria-label="إزالة الصورة"><X size={14}/></button></span>}<input value={text} disabled={send.isPending} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && (text.trim() || attachment)) send.mutate(); }} placeholder="اكتب رسالة…" aria-label="نص الرسالة"/><button type="button" className="send-button" aria-label="إرسال الرسالة" disabled={(!text.trim() && !attachment) || send.isPending} onClick={() => send.mutate()}>{send.isPending ? <LoaderCircle className="animate-spin" size={18}/> : <Send size={18}/>}</button></div>
      </> : <div className="content-placeholder"><MessageCircle size={32}/><h3>اختر محادثة</h3><p>اختر محادثة من القائمة لعرض رسائلها.</p></div>}
    </Surface>
  </div></AppShell>;
}
