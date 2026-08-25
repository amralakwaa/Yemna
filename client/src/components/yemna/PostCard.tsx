/** فلسفة يمنا: بطاقة منشور موحدة تربط التفاعل والتعليق ببيانات REST الحية. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Ellipsis, Heart, MessageCircle, Share2, UsersRound, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { Post } from "@/lib/yemnaData";
import { api, ApiError, type ApiPostEngagement, type ApiReactionType, asPerson } from "@/lib/api";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { Avatar, Verified } from "./UI";

const reactions: Array<{ type: ApiReactionType; emoji: string; label: string }> = [
  { type: "LIKE", emoji: "👍", label: "أعجبني" }, { type: "LOVE", emoji: "❤️", label: "أحببته" },
  { type: "SUPPORT", emoji: "💛", label: "أدعمه" }, { type: "WOW", emoji: "😮", label: "واو" },
  { type: "SAD", emoji: "😢", label: "أحزنني" }, { type: "ANGRY", emoji: "😡", label: "أغضبني" },
];

const emptySummary = (): ApiPostEngagement["reactionSummary"] => ({ LIKE: 0, LOVE: 0, SUPPORT: 0, WOW: 0, SAD: 0, ANGRY: 0 });
const sum = (summary: ApiPostEngagement["reactionSummary"]) => Object.values(summary).reduce((total, value) => total + value, 0);
function localEngagement(post: Post): ApiPostEngagement {
  const reactionSummary = { ...emptySummary(), ...post.reactionSummary };
  return { reactionSummary, reactionTotal: sum(reactionSummary) || post.reactions, viewerReaction: null, saved: Boolean(post.saved), reactors: [] };
}

export function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const postId = typeof post.id === "string" ? post.id : null;
  const { isAuthenticated } = useCurrentUser();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const engagementQuery = useQuery({ queryKey: ["rest", "post", postId, "engagement"], queryFn: () => api.getPostEngagement(postId || ""), enabled: Boolean(postId && isAuthenticated), retry: 1 });
  const reactionsQuery = useQuery({ queryKey: ["rest", "post", postId, "reactions"], queryFn: () => api.getPostReactions(postId || ""), enabled: Boolean(postId && reactorsOpen), retry: 1 });
  const rawEngagement = engagementQuery.data;
  const engagement = rawEngagement ? { ...rawEngagement, reactionSummary: { ...emptySummary(), ...rawEngagement.reactionSummary } } : localEngagement(post);
  const selectedReaction = reactions.find(reaction => reaction.type === engagement.viewerReaction);
  const summaryEntries = reactions.filter(reaction => engagement.reactionSummary[reaction.type] > 0);
  const engagementKey = ["rest", "post", postId, "engagement"];
  const writeEngagement = (next: ApiPostEngagement) => queryClient.setQueryData(engagementKey, next);
  const announceError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : "تعذر حفظ التغيير، حاول مجدداً");
  const reactionMutation = useMutation({
    mutationFn: (type: ApiReactionType) => api.reactToPost(postId || "", type),
    onMutate: async type => {
      if (!postId) return undefined;
      await queryClient.cancelQueries({ queryKey: engagementKey });
      const previous = queryClient.getQueryData<ApiPostEngagement>(engagementKey);
      const current = previous || localEngagement(post);
      const viewerReaction = current.viewerReaction === type ? null : type;
      const reactionSummary = { ...current.reactionSummary };
      if (current.viewerReaction) reactionSummary[current.viewerReaction] = Math.max(0, reactionSummary[current.viewerReaction] - 1);
      if (viewerReaction) reactionSummary[viewerReaction] += 1;
      writeEngagement({ ...current, reactionSummary, reactionTotal: sum(reactionSummary), viewerReaction });
      return { previous };
    },
    onError: (error, _type, context) => { if (context?.previous) writeEngagement(context.previous); announceError(error); },
    onSuccess: result => writeEngagement(result.engagement),
    onSettled: () => {
      setPickerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId], exact: true });
      void queryClient.invalidateQueries({ queryKey: ["rest", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["rest", "post", postId, "reactions"] });
    },
  });
  const saveMutation = useMutation({
    mutationFn: () => api.toggleSavePost(postId || ""),
    onMutate: async () => {
      if (!postId) return undefined;
      await queryClient.cancelQueries({ queryKey: engagementKey });
      const previous = queryClient.getQueryData<ApiPostEngagement>(engagementKey);
      const current = previous || localEngagement(post);
      writeEngagement({ ...current, saved: !current.saved });
      return { previous };
    },
    onError: (error, _variables, context) => { if (context?.previous) writeEngagement(context.previous); announceError(error); },
    onSuccess: result => { const current = queryClient.getQueryData<ApiPostEngagement>(engagementKey) || localEngagement(post); writeEngagement({ ...current, saved: result.saved }); },
  });
  return <article className={`post-card ${compact ? "post-compact" : ""}`}>
    <header className="post-header">
      <div className="post-author"><Avatar person={post.author}/><div><strong>{post.author.name} {post.author.verified && <Verified/>}</strong><span>{post.group ? `${post.group} · ` : ""}{post.time} · <b>◉</b></span></div></div>
      <button className="icon-button" aria-label="خيارات المنشور"><Ellipsis size={20}/></button>
    </header>
    <p className="post-text">{post.text}</p>
    {post.image && <div className="post-image">{post.mediaKind === "VIDEO" ? <video src={post.image} controls preload="metadata" aria-label="فيديو مرفق بالمنشور" /> : <img src={post.image} alt="صورة مرفقة بالمنشور" />}</div>}
    <div className="post-stats"><button className="reaction-summary" onClick={() => postId && setReactorsOpen(true)} disabled={!postId || !engagement.reactionTotal} aria-label="عرض المتفاعلين">{summaryEntries.slice(0, 3).map(reaction => <i key={reaction.type} title={reaction.label}>{reaction.emoji}</i>)} {engagement.reactionTotal ? <b>{engagement.reactionTotal}</b> : <span>كن أول المتفاعلين</span>}</button><span>{post.comments} تعليقاً &nbsp; {post.shares} مشاركة</span></div>
    <div className="post-actions">
      {isAuthenticated && postId ? <div className="reaction-control"><button className={selectedReaction ? "action active-like" : "action"} disabled={reactionMutation.isPending} onClick={() => setPickerOpen(open => !open)} aria-expanded={pickerOpen}><Heart size={19} fill={selectedReaction ? "currentColor" : "none"}/> {selectedReaction?.label || "تفاعل"}</button>{pickerOpen && <div className="reaction-picker" role="group" aria-label="اختر تفاعلاً">{reactions.map(reaction => <button type="button" key={reaction.type} title={reaction.label} aria-label={reaction.label} disabled={reactionMutation.isPending} onClick={() => reactionMutation.mutate(reaction.type)}>{reaction.emoji}</button>)}</div>}</div> : <Link href="/login" className="action"><Heart size={19}/>تفاعل</Link>}
      <Link href={`/post/${post.id}`} className="action"><MessageCircle size={19}/> تعليق</Link>
      <button className="action"><Share2 size={19}/> مشاركة</button>
      {isAuthenticated && postId ? <button className={engagement.saved ? "action active-like" : "action"} disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}><Bookmark size={19} fill={engagement.saved ? "currentColor" : "none"}/> {engagement.saved ? "محفوظ" : "حفظ"}</button> : <Link href="/login" className="action"><Bookmark size={19}/>حفظ</Link>}
    </div>
    {reactorsOpen && <div className="reactors-dialog-backdrop" role="presentation" onMouseDown={() => setReactorsOpen(false)}><section className="reactors-dialog" role="dialog" aria-modal="true" aria-label="المتفاعلون" onMouseDown={event => event.stopPropagation()}><header><div><UsersRound size={19}/><b>التفاعلات</b><small>{engagement.reactionTotal} تفاعلاً</small></div><button className="icon-button" onClick={() => setReactorsOpen(false)} aria-label="إغلاق"><X size={18}/></button></header><div className="reactor-type-totals">{summaryEntries.map(reaction => <span key={reaction.type}>{reaction.emoji} {engagement.reactionSummary[reaction.type]}</span>)}</div>{reactionsQuery.isLoading ? <p className="muted-center">يجري تحميل المتفاعلين…</p> : reactionsQuery.isError ? <p className="muted-center">تعذر تحميل قائمة المتفاعلين.</p> : reactionsQuery.data?.length ? <div className="reactor-list">{reactionsQuery.data.map(item => <Link href={`/profile/${encodeURIComponent(item.user.username)}`} className="reactor-row" key={item.id} onClick={() => setReactorsOpen(false)}><Avatar person={asPerson(item.user)} size="sm"/><span><b>{item.user.displayName}</b><small>{reactions.find(reaction => reaction.type === item.type)?.emoji} {reactions.find(reaction => reaction.type === item.type)?.label}</small></span></Link>)}</div> : <p className="muted-center">لا توجد تفاعلات بعد.</p>}</section></div>}
  </article>;
}
