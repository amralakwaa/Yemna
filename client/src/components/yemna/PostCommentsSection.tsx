import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, EyeOff, Flag, Heart, MoreHorizontal, Send, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api, ApiError, type ApiComment, type ApiCommentEngagement, type ApiCommentSort, type ApiReactionType, type ApiUser, asPerson, asRelativeTime } from "@/lib/api";
import type { Person } from "@/lib/yemnaData";
import { Avatar, SectionHeading, Surface } from "./UI";
import { useRealtimeSubscription, type RealtimeEvent } from "@/lib/realtime";

type CommentTarget = { id: string; name: string } | null;
type MutationStatus = { create: boolean; update: boolean; remove: boolean; react: boolean };
const reactionOptions: Array<{ type: ApiReactionType; symbol: string; label: string }> = [
  { type: "LIKE", symbol: "👍", label: "أعجبني" }, { type: "LOVE", symbol: "❤️", label: "أحببته" },
  { type: "SUPPORT", symbol: "🤝", label: "أدعمه" }, { type: "WOW", symbol: "😮", label: "أدهشني" },
  { type: "SAD", symbol: "😢", label: "أحزنني" }, { type: "ANGRY", symbol: "😠", label: "أغضبني" },
];

export function PostCommentsSection({ postId, total, currentUser, currentPerson, currentUserLoading }: { postId: string; total: number; currentUser: ApiUser | null; currentPerson: Person | null; currentUserLoading: boolean }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentTarget>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [reactorsForCommentId, setReactorsForCommentId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentTarget>(null);
  const [reportReason, setReportReason] = useState("إساءة أو خطاب كراهية");
  const [reportDetails, setReportDetails] = useState("");
  const [sort, setSort] = useState<ApiCommentSort>("NEWEST");
  const commentsQuery = useQuery({ queryKey: ["rest", "post", postId, "comments", sort], queryFn: () => api.getPostComments(postId, sort), enabled: Boolean(postId), retry: 1 });
  const viewerReactionsQuery = useQuery({ queryKey: ["rest", "post", postId, "comment-viewer-reactions"], queryFn: () => api.getPostCommentViewerReactions(postId), enabled: Boolean(postId && currentUser), retry: false });
  const hiddenCommentsQuery = useQuery({ queryKey: ["rest", "post", postId, "hidden-comments"], queryFn: () => api.getHiddenPostCommentIds(postId), enabled: Boolean(postId && currentUser), retry: false });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId, "comments"] });
    void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId], exact: true });
    void queryClient.invalidateQueries({ queryKey: ["rest", "feed"] });
  };
  const createComment = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) => api.createPostComment(postId, text, parentId),
    onSuccess: (_item, variables) => {
      if (variables.parentId) { setReplyBody(""); setReplyTarget(null); toast.success("تم نشر ردك"); }
      else { setBody(""); toast.success("تم نشر تعليقك"); }
      refresh();
    },
    onError: error => toast.error(error instanceof ApiError && error.status === 401 ? "سجّل الدخول أولاً للكتابة" : "تعذر نشر التعليق، حاول لاحقاً"),
  });
  const updateComment = useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) => api.updatePostComment(postId, commentId, text),
    onSuccess: () => { setEditing(null); refresh(); toast.success("تم تعديل التعليق"); },
    onError: error => toast.error(error instanceof ApiError && error.status === 403 ? "لا تملك صلاحية تعديل هذا التعليق" : "تعذر تعديل التعليق"),
  });
  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.deletePostComment(postId, commentId),
    onSuccess: () => { if (editing) setEditing(null); refresh(); toast.success("تم حذف التعليق"); },
    onError: error => toast.error(error instanceof ApiError && error.status === 403 ? "لا تملك صلاحية حذف هذا التعليق" : "تعذر حذف التعليق"),
  });
  const reactToComment = useMutation({
    mutationFn: ({ commentId, type }: { commentId: string; type: ApiReactionType }) => api.reactToComment(postId, commentId, type),
    onSuccess: (_response, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId, "comments"] });
      void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId, "comment-viewer-reactions"] });
    },
    onError: error => toast.error(error instanceof ApiError && error.status === 401 ? "سجّل الدخول أولاً للتفاعل" : "تعذر حفظ التفاعل"),
  });
  const hideComment = useMutation({
    mutationFn: (commentId: string) => api.hidePostComment(postId, commentId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId, "hidden-comments"] }); toast.success("لن يظهر لك هذا التعليق بعد الآن"); },
    onError: () => toast.error("تعذر إخفاء التعليق"),
  });
  const reportComment = useMutation({
    mutationFn: ({ commentId, reason, details }: { commentId: string; reason: string; details: string }) => api.createSupportReport({ targetType: "COMMENT", targetId: commentId, reason, details: details.trim() || undefined }),
    onSuccess: () => { setReportTarget(null); setReportDetails(""); toast.success("تم إرسال البلاغ للمراجعة"); },
    onError: error => toast.error(error instanceof ApiError && error.status === 401 ? "سجّل الدخول أولاً للإبلاغ" : "تعذر إرسال البلاغ"),
  });
  const onRealtimeNotification = useCallback((event: RealtimeEvent) => {
    const notification = event.payload as { type?: string };
    if (notification.type !== "COMMENT_REPLY") return;
    void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId, "comments"] });
    toast.message("وصل رد جديد إلى أحد تعليقاتك");
  }, [postId, queryClient]);
  useRealtimeSubscription(["notification:new"], onRealtimeNotification);
  const status: MutationStatus = { create: createComment.isPending, update: updateComment.isPending, remove: deleteComment.isPending, react: reactToComment.isPending };
  const hiddenIds = new Set(hiddenCommentsQuery.data?.commentIds ?? []);
  const commentItems = Array.isArray(commentsQuery.data) ? commentsQuery.data : [];
  const visibleComments = commentItems.filter(comment => !hiddenIds.has(comment.id)).map(comment => ({ ...comment, replies: comment.replies?.filter(reply => !hiddenIds.has(reply.id)) }));
  const submitTopLevel = () => {
    if (!currentPerson) return;
    const text = body.trim();
    if (text) createComment.mutate({ text });
  };
  return <Surface className="comments-card post-comments-section"><SectionHeading title={`التعليقات (${total})`} action={<label className="comments-sort"><span className="sr-only">ترتيب التعليقات</span><select value={sort} onChange={event => setSort(event.target.value as ApiCommentSort)} aria-label="ترتيب التعليقات"><option value="NEWEST">الأحدث أولاً</option><option value="TOP">الأكثر تفاعلاً</option></select><ChevronDown size={14}/></label>}/><CommentComposer value={body} onChange={setBody} onSubmit={submitTopLevel} disabled={!currentPerson || status.create} placeholder={currentPerson ? "اكتب تعليقاً..." : "سجّل الدخول لكتابة تعليق"} currentPerson={currentPerson} loadingUser={currentUserLoading}/>{commentsQuery.isLoading ? <p className="muted-center">يجري تحميل التعليقات…</p> : commentsQuery.isError ? <p className="muted-center">تعذر تحميل التعليقات. حاول التحديث لاحقاً.</p> : visibleComments.length ? <div className="comment-thread">{visibleComments.map(item => <CommentItem key={item.id} item={item} currentUserId={currentUser?.id} currentPerson={currentPerson} viewerReactions={viewerReactionsQuery.data?.viewerReactions ?? {}} replyTarget={replyTarget} setReplyTarget={setReplyTarget} replyBody={replyBody} setReplyBody={setReplyBody} editing={editing} setEditing={setEditing} onCreateReply={text => createComment.mutate({ text, parentId: item.id })} onUpdate={(commentId, text) => updateComment.mutate({ commentId, text })} onDelete={commentId => deleteComment.mutate(commentId)} onReact={(commentId, type) => reactToComment.mutate({ commentId, type })} onShowReactors={setReactorsForCommentId} onHide={commentId => hideComment.mutate(commentId)} onReport={setReportTarget} status={status}/>)}</div> : <p className="muted-center comments-empty">لا توجد تعليقات ظاهرة حالياً.</p>}{reactorsForCommentId ? <CommentReactorsDialog postId={postId} commentId={reactorsForCommentId} onClose={() => setReactorsForCommentId(null)}/> : null}{reportTarget ? <CommentReportDialog target={reportTarget} reason={reportReason} details={reportDetails} pending={reportComment.isPending} onReason={setReportReason} onDetails={setReportDetails} onClose={() => setReportTarget(null)} onSubmit={() => reportComment.mutate({ commentId: reportTarget.id, reason: reportReason, details: reportDetails })}/> : null}</Surface>;
}

function CommentComposer({ value, onChange, onSubmit, disabled, placeholder, currentPerson, loadingUser, reply = false }: { value: string; onChange: (value: string) => void; onSubmit: () => void; disabled: boolean; placeholder: string; currentPerson: Person | null; loadingUser?: boolean; reply?: boolean }) {
  return <div className={`comment-composer ${reply ? "comment-reply-composer" : ""}`}>{loadingUser ? <span className="comment-loading-avatar" aria-label="يجري تحميل الحساب">…</span> : currentPerson ? <Avatar person={currentPerson} size="sm"/> : <Link href="/login" className="text-button">تسجيل الدخول</Link>}<input disabled={disabled} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.key === "Enter" && !event.shiftKey && (event.preventDefault(), onSubmit())} maxLength={2000} placeholder={placeholder}/><button disabled={disabled || !value.trim()} onClick={onSubmit} aria-label={reply ? "نشر الرد" : "نشر التعليق"}><Send size={17}/></button></div>;
}

function CommentItem({ item, currentUserId, currentPerson, viewerReactions, replyTarget, setReplyTarget, replyBody, setReplyBody, editing, setEditing, onCreateReply, onUpdate, onDelete, onReact, onShowReactors, onHide, onReport, status, nested = false }: { item: ApiComment; currentUserId?: string; currentPerson: Person | null; viewerReactions: Record<string, ApiReactionType>; replyTarget: CommentTarget; setReplyTarget: (target: CommentTarget) => void; replyBody: string; setReplyBody: (body: string) => void; editing: { id: string; body: string } | null; setEditing: (editing: { id: string; body: string } | null) => void; onCreateReply: (text: string) => void; onUpdate: (commentId: string, text: string) => void; onDelete: (commentId: string) => void; onReact: (commentId: string, type: ApiReactionType) => void; onShowReactors: (commentId: string) => void; onHide: (commentId: string) => void; onReport: (target: CommentTarget) => void; status: MutationStatus; nested?: boolean }) {
  const isOwner = currentUserId === item.author.id;
  const isEditing = editing?.id === item.id;
  const isReplying = replyTarget?.id === item.id;
  const startReply = () => { if (!currentPerson) return; setReplyTarget({ id: item.id, name: item.author.displayName }); setReplyBody(""); };
  const saveEdit = () => { const text = editing?.body.trim(); if (text) onUpdate(item.id, text); else toast.error("لا يمكن أن يكون التعليق فارغاً"); };
  const viewerReaction = viewerReactions[item.id] ?? item.viewerReaction ?? null;
  return <div className={`comment-item ${nested ? "comment-item-reply" : ""}`}><div className="comment-row"><Avatar person={asPerson(item.author)} size="sm"/><div className="comment-content"><div className="comment-bubble"><Link href={`/profile/${encodeURIComponent(item.author.username)}`}><b>{item.author.displayName}</b></Link>{isEditing ? <textarea value={editing.body} onChange={event => setEditing({ id: item.id, body: event.target.value })} maxLength={2000} autoFocus/> : <p>{item.body}</p>}</div><div className="comment-meta"><span>{asRelativeTime(item.createdAt)}</span><CommentReactionControl item={item} currentPerson={currentPerson} viewerReaction={viewerReaction} disabled={status.react} onReact={type => onReact(item.id, type)} onShowReactors={() => onShowReactors(item.id)}/>{!nested && <button className="text-button" onClick={startReply} disabled={!currentPerson}>رد</button>}{currentPerson && <span className="comment-safety-actions"><button className="text-button" onClick={() => onHide(item.id)}><EyeOff size={14}/>إخفاء</button><button className="text-button" onClick={() => onReport({ id: item.id, name: item.author.displayName })}><Flag size={14}/>إبلاغ</button></span>}{isOwner && <span className="comment-owner-actions"><button className="icon-button comment-menu" aria-label="خيارات التعليق"><MoreHorizontal size={16}/></button><button className="text-button" onClick={() => setEditing({ id: item.id, body: item.body })}>تعديل</button><button className="text-button danger" disabled={status.remove} onClick={() => window.confirm("هل تريد حذف هذا التعليق؟") && onDelete(item.id)}>حذف</button></span>}</div>{isEditing && <div className="comment-edit-actions"><button className="text-button" onClick={() => setEditing(null)}>إلغاء</button><button className="text-button" disabled={status.update} onClick={saveEdit}>حفظ</button></div>}</div></div>{isReplying && <div className="reply-composer-wrap"><span>رداً على {replyTarget.name}</span><CommentComposer value={replyBody} onChange={setReplyBody} onSubmit={() => replyBody.trim() && onCreateReply(replyBody.trim())} disabled={!currentPerson || status.create} placeholder="اكتب ردك…" currentPerson={currentPerson} reply/><button className="text-button" onClick={() => setReplyTarget(null)}>إلغاء</button></div>}{!nested && item.replies?.length ? <div className="comment-replies">{item.replies.map(reply => <CommentItem key={reply.id} item={reply} currentUserId={currentUserId} currentPerson={currentPerson} viewerReactions={viewerReactions} replyTarget={replyTarget} setReplyTarget={setReplyTarget} replyBody={replyBody} setReplyBody={setReplyBody} editing={editing} setEditing={setEditing} onCreateReply={onCreateReply} onUpdate={onUpdate} onDelete={onDelete} onReact={onReact} onShowReactors={onShowReactors} onHide={onHide} onReport={onReport} status={status} nested/>)}</div> : null}</div>;
}

function CommentReactionControl({ item, currentPerson, viewerReaction, disabled, onReact, onShowReactors }: { item: ApiComment; currentPerson: Person | null; viewerReaction: ApiReactionType | null; disabled: boolean; onReact: (type: ApiReactionType) => void; onShowReactors: () => void }) {
  const [open, setOpen] = useState(false);
  const active = reactionOptions.find(option => option.type === viewerReaction);
  const summary = reactionOptions.filter(option => (item.reactionSummary?.[option.type] ?? 0) > 0).slice(0, 3);
  if (!currentPerson) return <Link href="/login" className="comment-reaction-trigger" aria-label="سجّل الدخول للتفاعل"><Heart size={14}/>تفاعل{item.reactionTotal ? <small>{item.reactionTotal}</small> : null}</Link>;
  return <span className="comment-reaction-control"><button type="button" className={`comment-reaction-trigger ${active ? "is-active" : ""}`} onClick={() => setOpen(value => !value)} disabled={disabled} aria-expanded={open} aria-label={active ? `تفاعلك: ${active.label}` : "إضافة تفاعل"}>{active?.symbol ?? <Heart size={14}/>}<span>{active?.label ?? "تفاعل"}</span></button>{item.reactionTotal ? <button type="button" className="comment-reaction-count" onClick={onShowReactors} aria-label={`عرض ${item.reactionTotal} متفاعل`}>{item.reactionTotal}</button> : null}{open ? <span className="comment-reaction-picker" role="menu" aria-label="اختر تفاعلاً">{reactionOptions.map(option => <button type="button" key={option.type} title={option.label} aria-label={option.label} onClick={() => { onReact(option.type); setOpen(false); }}><span>{option.symbol}</span></button>)}</span> : null}{summary.length ? <button type="button" className="comment-reaction-summary" onClick={onShowReactors} aria-label={`${item.reactionTotal ?? 0} تفاعل`}>{summary.map(option => <span key={option.type}>{option.symbol}</span>)}</button> : null}</span>;
}

function CommentReactorsDialog({ postId, commentId, onClose }: { postId: string; commentId: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["rest", "post", postId, "comment", commentId, "reactions"], queryFn: () => api.getCommentReactions(postId, commentId), retry: 1 });
  return <div className="comment-dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="comment-dialog" role="dialog" aria-modal="true" aria-label="المتفاعلون مع التعليق" onMouseDown={event => event.stopPropagation()}><header><h3>المتفاعلون مع التعليق</h3><button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></header>{query.isLoading ? <p className="muted-center">يجري تحميل المتفاعلين…</p> : query.isError ? <p className="muted-center">تعذر تحميل المتفاعلين.</p> : query.data?.length ? <div className="comment-reactors-list">{query.data.map(reaction => <Link href={`/profile/${encodeURIComponent(reaction.user.username)}`} key={reaction.id} className="comment-reactor"><Avatar person={asPerson(reaction.user)} size="sm"/><span><b>{reaction.user.displayName}</b><small>{reactionOptions.find(option => option.type === reaction.type)?.symbol} {reactionOptions.find(option => option.type === reaction.type)?.label}</small></span></Link>)}</div> : <p className="muted-center">لا توجد تفاعلات بعد.</p>}</section></div>;
}

function CommentReportDialog({ target, reason, details, pending, onReason, onDetails, onClose, onSubmit }: { target: NonNullable<CommentTarget>; reason: string; details: string; pending: boolean; onReason: (value: string) => void; onDetails: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="comment-dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="comment-dialog comment-report-dialog" role="dialog" aria-modal="true" aria-label="إبلاغ عن تعليق" onMouseDown={event => event.stopPropagation()}><header><h3>إبلاغ عن تعليق {target.name}</h3><button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></header><p>سيصل البلاغ إلى فريق الإشراف للمراجعة؛ لن يُرسل لصاحب التعليق أي إشعار بهويتك.</p><label>سبب البلاغ<select value={reason} onChange={event => onReason(event.target.value)}><option>إساءة أو خطاب كراهية</option><option>معلومات مضللة</option><option>محتوى غير مناسب</option><option>انتهاك الخصوصية</option><option>سبب آخر</option></select></label><label>تفاصيل إضافية (اختياري)<textarea value={details} onChange={event => onDetails(event.target.value)} maxLength={1000}/></label><footer><button className="text-button" onClick={onClose}>إلغاء</button><button className="danger-button" disabled={pending} onClick={onSubmit}>إرسال البلاغ</button></footer></section></div>;
}
