import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownLeft, MoreHorizontal, Send } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api, ApiError, type ApiComment, type ApiUser, asPerson, asRelativeTime } from "@/lib/api";
import type { Person } from "@/lib/yemnaData";
import { Avatar, SectionHeading, Surface } from "./UI";

type CommentTarget = { id: string; name: string } | null;
type MutationStatus = { create: boolean; update: boolean; remove: boolean };

export function PostCommentsSection({ postId, total, currentUser, currentPerson, currentUserLoading }: { postId: string; total: number; currentUser: ApiUser | null; currentPerson: Person | null; currentUserLoading: boolean }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentTarget>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const commentsQuery = useQuery({ queryKey: ["rest", "post", postId, "comments"], queryFn: () => api.getPostComments(postId), enabled: Boolean(postId), retry: 1 });
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
  const status: MutationStatus = { create: createComment.isPending, update: updateComment.isPending, remove: deleteComment.isPending };
  const submitTopLevel = () => {
    if (!currentPerson) return;
    const text = body.trim();
    if (text) createComment.mutate({ text });
  };
  return <Surface className="comments-card post-comments-section"><SectionHeading title={`التعليقات (${total})`} action={<span className="comments-sort">الأحدث أولاً</span>}/><CommentComposer value={body} onChange={setBody} onSubmit={submitTopLevel} disabled={!currentPerson || status.create} placeholder={currentPerson ? "اكتب تعليقاً..." : "سجّل الدخول لكتابة تعليق"} currentPerson={currentPerson} loadingUser={currentUserLoading}/>{commentsQuery.isLoading ? <p className="muted-center">يجري تحميل التعليقات…</p> : commentsQuery.isError ? <p className="muted-center">تعذر تحميل التعليقات. حاول التحديث لاحقاً.</p> : commentsQuery.data?.length ? <div className="comment-thread">{commentsQuery.data.map(item => <CommentItem key={item.id} item={item} currentUserId={currentUser?.id} currentPerson={currentPerson} replyTarget={replyTarget} setReplyTarget={setReplyTarget} replyBody={replyBody} setReplyBody={setReplyBody} editing={editing} setEditing={setEditing} onCreateReply={text => createComment.mutate({ text, parentId: item.id })} onUpdate={(commentId, text) => updateComment.mutate({ commentId, text })} onDelete={commentId => deleteComment.mutate(commentId)} status={status}/>)}</div> : <p className="muted-center comments-empty">لا توجد تعليقات بعد. كن أول من يشارك رأيه.</p>}</Surface>;
}

function CommentComposer({ value, onChange, onSubmit, disabled, placeholder, currentPerson, loadingUser, reply = false }: { value: string; onChange: (value: string) => void; onSubmit: () => void; disabled: boolean; placeholder: string; currentPerson: Person | null; loadingUser?: boolean; reply?: boolean }) {
  return <div className={`comment-composer ${reply ? "comment-reply-composer" : ""}`}>{loadingUser ? <span className="comment-loading-avatar" aria-label="يجري تحميل الحساب">…</span> : currentPerson ? <Avatar person={currentPerson} size="sm"/> : <Link href="/login" className="text-button">تسجيل الدخول</Link>}<input disabled={disabled} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.key === "Enter" && !event.shiftKey && (event.preventDefault(), onSubmit())} maxLength={2000} placeholder={placeholder}/><button disabled={disabled || !value.trim()} onClick={onSubmit} aria-label={reply ? "نشر الرد" : "نشر التعليق"}><Send size={17}/></button></div>;
}

function CommentItem({ item, currentUserId, currentPerson, replyTarget, setReplyTarget, replyBody, setReplyBody, editing, setEditing, onCreateReply, onUpdate, onDelete, status, nested = false }: { item: ApiComment; currentUserId?: string; currentPerson: Person | null; replyTarget: CommentTarget; setReplyTarget: (target: CommentTarget) => void; replyBody: string; setReplyBody: (body: string) => void; editing: { id: string; body: string } | null; setEditing: (editing: { id: string; body: string } | null) => void; onCreateReply: (text: string) => void; onUpdate: (commentId: string, text: string) => void; onDelete: (commentId: string) => void; status: MutationStatus; nested?: boolean }) {
  const isOwner = currentUserId === item.author.id;
  const isEditing = editing?.id === item.id;
  const isReplying = replyTarget?.id === item.id;
  const startReply = () => { if (!currentPerson) return; setReplyTarget({ id: item.id, name: item.author.displayName }); setReplyBody(""); };
  const saveEdit = () => { const text = editing?.body.trim(); if (text) onUpdate(item.id, text); else toast.error("لا يمكن أن يكون التعليق فارغاً"); };
  return <div className={`comment-item ${nested ? "comment-item-reply" : ""}`}><div className="comment-row"><Avatar person={asPerson(item.author)} size="sm"/><div className="comment-content"><div className="comment-bubble"><Link href={`/profile/${encodeURIComponent(item.author.username)}`}><b>{item.author.displayName}</b></Link>{isEditing ? <textarea value={editing.body} onChange={event => setEditing({ id: item.id, body: event.target.value })} maxLength={2000} autoFocus/> : <p>{item.body}</p>}</div><div className="comment-meta"><span>{asRelativeTime(item.createdAt)}</span>{!nested && <button className="text-button" onClick={startReply} disabled={!currentPerson}>رد</button>}{isOwner && <span className="comment-owner-actions"><button className="icon-button comment-menu" aria-label="خيارات التعليق"><MoreHorizontal size={16}/></button><button className="text-button" onClick={() => setEditing({ id: item.id, body: item.body })}>تعديل</button><button className="text-button danger" disabled={status.remove} onClick={() => window.confirm("هل تريد حذف هذا التعليق؟") && onDelete(item.id)}>حذف</button></span>}</div>{isEditing && <div className="comment-edit-actions"><button className="text-button" onClick={() => setEditing(null)}>إلغاء</button><button className="text-button" disabled={status.update} onClick={saveEdit}>حفظ</button></div>}</div></div>{isReplying && <div className="reply-composer-wrap"><span>رداً على {replyTarget.name}</span><CommentComposer value={replyBody} onChange={setReplyBody} onSubmit={() => replyBody.trim() && onCreateReply(replyBody.trim())} disabled={!currentPerson || status.create} placeholder="اكتب ردك…" currentPerson={currentPerson} reply/><button className="text-button" onClick={() => setReplyTarget(null)}>إلغاء</button></div>}{!nested && item.replies?.length ? <div className="comment-replies">{item.replies.map(reply => <CommentItem key={reply.id} item={reply} currentUserId={currentUserId} currentPerson={currentPerson} replyTarget={replyTarget} setReplyTarget={setReplyTarget} replyBody={replyBody} setReplyBody={setReplyBody} editing={editing} setEditing={setEditing} onCreateReply={onCreateReply} onUpdate={onUpdate} onDelete={onDelete} status={status} nested/>)}</div> : null}</div>;
}
