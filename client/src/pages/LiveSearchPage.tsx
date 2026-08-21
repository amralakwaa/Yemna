import { useQuery } from "@tanstack/react-query";
import { FileText, LoaderCircle, Search, Users, UsersRound, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AppShell } from "@/components/yemna/AppShell";
import { Avatar, Pill, SearchBox, SectionHeading, Surface } from "@/components/yemna/UI";
import { api, asPerson } from "@/lib/api";

type SearchType = "all" | "users" | "posts" | "communities";
const filters: Array<{ label: string; type: SearchType }> = [
  { label: "الكل", type: "all" },
  { label: "الأشخاص", type: "users" },
  { label: "المنشورات", type: "posts" },
  { label: "المجتمعات", type: "communities" },
];

function SearchState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <Surface className="content-placeholder"><span>{icon}</span><h3>{title}</h3><p>{text}</p></Surface>;
}

export function LiveSearchPage() {
  const [term, setTerm] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const normalized = term.trim();
  const query = useQuery({ queryKey: ["rest", "search", normalized, type], queryFn: () => api.search(normalized, type), enabled: normalized.length >= 2, retry: 1 });
  const results = {
    users: query.data?.users ?? [],
    posts: query.data?.posts ?? [],
    communities: query.data?.communities ?? [],
  };
  const total = useMemo(() => results.users.length + results.posts.length + results.communities.length, [results.users, results.posts, results.communities]);

  return <AppShell title="البحث"><div className="explore-narrow"><Surface className="search-detail-head"><SearchBox value={term} onChange={setTerm} placeholder="ابحث في يمنا"/><div className="search-tabs">{filters.map(filter => <Pill key={filter.type} active={type === filter.type} onClick={() => setType(filter.type)}>{filter.label}</Pill>)}</div><p>ابحث عن أشخاص ومنشورات ومجتمعات من منصة يمنا.</p></Surface><section className="search-result-stack"><SectionHeading title={normalized ? `نتائج «${normalized}»` : "ابدأ البحث"} action={normalized.length >= 2 && !query.isLoading ? <small>{total} نتيجة</small> : undefined}/>{normalized.length < 2 ? <SearchState icon={<Search size={28}/>} title="ابحث في يمنا" text="اكتب حرفين على الأقل لبدء البحث في الأشخاص والمنشورات والمجتمعات."/> : query.isLoading ? <SearchState icon={<LoaderCircle className="animate-spin" size={28}/>} title="يجري البحث…" text="نبحث في النتائج المتاحة لك."/> : query.isError ? <SearchState icon={<WifiOff size={28}/>} title="تعذر إتمام البحث" text="تحقق من اتصالك ثم حاول مرة أخرى."/> : total === 0 ? <SearchState icon={<Search size={28}/>} title="لا توجد نتائج" text="جرّب عبارة مختلفة أو نوع بحث آخر."/> : <>{results.users.map(user => <Surface className="universal-result" key={`user-${user.id}`}><Avatar person={asPerson(user)} size="lg"/><div><b>{user.displayName}</b><p>{user.city || user.governorate || "عضو في يمنا"}</p><small>{user.bio || `@${user.username}`}</small></div><Link href={`/profile/${encodeURIComponent(user.username || user.id)}`} className="button outline small">عرض الملف</Link></Surface>)}{results.posts.map(post => <Surface className="universal-result image-result" key={`post-${post.id}`}>{post.media?.[0]?.url ? <img src={post.media[0].url} alt=""/> : <span className="notification-icon"><FileText size={19}/></span>}<div><b>{post.author.displayName}</b><p>{post.body}</p><small>{post._count.reactions} تفاعل · {post._count.comments} تعليق</small></div></Surface>)}{results.communities.map(community => <Surface className="universal-result image-result" key={`community-${community.id}`}>{community.coverUrl ? <img src={community.coverUrl} alt=""/> : <span className="notification-icon"><UsersRound size={19}/></span>}<div><b>{community.name}</b><p>{community.description || "مجتمع يمني على منصة يمنا"}</p><small>{community._count?.members || 0} عضو</small></div><Link href={`/communities?community=${community.slug}`} className="button outline small">استكشاف</Link></Surface>)}</>}</section></div></AppShell>;
}
