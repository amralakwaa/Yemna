/** فلسفة يمنا: بطاقة منشور موحدة تغلّب المحتوى العربي والصورة على الزخرفة. */
import { useState } from "react";
import { Bookmark, Ellipsis, Heart, MessageCircle, Send, Share2 } from "lucide-react";
import type { Post } from "@/lib/yemnaData";
import { Avatar, Verified } from "./UI";

export function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [showComments, setShowComments] = useState(false);
  const count = post.reactions + (liked ? 1 : 0);
  return <article className={`post-card ${compact ? "post-compact" : ""}`}>
    <header className="post-header">
      <div className="post-author"><Avatar person={post.author}/><div><strong>{post.author.name} {post.author.verified && <Verified/>}</strong><span>{post.group ? `${post.group} · ` : ""}{post.time} · <b>◉</b></span></div></div>
      <button className="icon-button" aria-label="خيارات المنشور"><Ellipsis size={20}/></button>
    </header>
    <p className="post-text">{post.text}</p>
    {post.image && <div className="post-image"><img src={post.image} alt="صورة مرفقة بالمنشور" /></div>}
    <div className="post-stats"><span className="reaction-stack"><i>👍</i><i>❤</i><i>😮</i> {count}</span><span>{post.comments} تعليقاً &nbsp; {post.shares} مشاركة</span></div>
    <div className="post-actions">
      <button className={liked ? "action active-like" : "action"} onClick={() => setLiked(!liked)}><Heart size={19} fill={liked ? "currentColor" : "none"}/> {liked ? "أعجبني" : "أعجبني"}</button>
      <button className="action" onClick={() => setShowComments(!showComments)}><MessageCircle size={19}/> تعليق</button>
      <button className="action"><Share2 size={19}/> مشاركة</button>
      <button className={saved ? "action active-like" : "action"} onClick={() => setSaved(!saved)}><Bookmark size={19} fill={saved ? "currentColor" : "none"}/> حفظ</button>
    </div>
    {showComments && <div className="inline-comments"><div className="comment-line"><Avatar person={{...post.author, name:"سارة الزرحاني", avatar:"https://i.pravatar.cc/100?img=49"}} size="sm"/><p><b>سارة الزرحاني</b><br/>مبادرة ملهمة، شكراً لكم على المشاركة.</p></div><label className="comment-input"><input placeholder="اكتب تعليقاً..."/><Send size={17}/></label></div>}
  </article>;
}
