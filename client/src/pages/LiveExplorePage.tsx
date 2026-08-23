import { useQuery } from "@tanstack/react-query";
import { Compass, FileText, LoaderCircle, Search, UsersRound, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { AppShell } from "@/components/yemna/AppShell";
import { SectionHeading, Surface } from "@/components/yemna/UI";
import { api, asRelativeTime } from "@/lib/api";

function ExploreState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Surface className="content-placeholder">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </Surface>
  );
}

function postMediaUrl(media: Array<{ publicUrl?: string | null; url?: string | null }> | undefined) {
  const item = media?.find((candidate) => candidate.publicUrl || candidate.url);
  return item?.publicUrl || item?.url || null;
}

/**
 * الاستكشاف الإنتاجي: يعرض المنشورات والمجتمعات التي تعود فعلياً من API.
 * لا توجد اقتراحات أو وسوم أو إحصاءات ثابتة، ولا يكشف مسارات التفاصيل غير المكتملة.
 */
export function LiveExplorePage() {
  const feedQuery = useQuery({
    queryKey: ["rest", "explore", "feed"],
    queryFn: api.getFeed,
    retry: 1,
  });
  const communitiesQuery = useQuery({
    queryKey: ["rest", "explore", "communities"],
    queryFn: api.getCommunities,
    retry: 1,
  });
  const posts = feedQuery.data?.items ?? [];
  const communities = Array.isArray(communitiesQuery.data) ? communitiesQuery.data : [];

  return (
    <AppShell title="استكشاف">
      <main className="explore-narrow" aria-label="استكشاف يمنا">
        <Surface className="community-hero live-communities-hero">
          <div>
            <span className="eyebrow">استكشاف يمنا</span>
            <h1>تعرّف إلى ما ينشره أعضاء يمنا ومجتمعاتهم.</h1>
            <p>تعتمد هذه الصفحة على المنشورات والمجتمعات المتاحة من المنصة الآن.</p>
            <Link href="/search" className="button">
              <Search size={18} aria-hidden="true" />
              فتح البحث
            </Link>
          </div>
          <Compass aria-hidden="true" size={42} strokeWidth={1.5} />
        </Surface>

        <section className="search-result-stack" aria-live="polite">
          <SectionHeading
            title="منشورات حديثة"
            action={<Link href="/" className="button outline small">عرض الرئيسية</Link>}
          />
          {feedQuery.isLoading ? (
            <ExploreState icon={<LoaderCircle className="animate-spin" size={28} />} title="يجري تحميل المنشورات…" text="نحمّل المحتوى المتاح من يمنا." />
          ) : feedQuery.isError ? (
            <ExploreState icon={<WifiOff size={28} />} title="تعذر تحميل المنشورات" text="تحقق من اتصالك ثم أعد المحاولة." />
          ) : posts.length === 0 ? (
            <ExploreState icon={<FileText size={28} />} title="لا توجد منشورات عامة بعد" text="ستظهر المنشورات هنا عندما تصبح متاحة في المنصة." />
          ) : (
            <div className="search-result-stack">
              {posts.map((post) => {
                const mediaUrl = postMediaUrl(post.media);
                return (
                  <Surface className="universal-result image-result" key={post.id}>
                    {mediaUrl ? <img src={mediaUrl} alt="" /> : <span className="notification-icon"><FileText size={19} /></span>}
                    <div>
                      <Link href={`/profile/${encodeURIComponent(post.author.username || post.author.id)}`}><b>{post.author.displayName}</b></Link>
                      <p>{post.body || "منشور بلا نص"}</p>
                      <small>{asRelativeTime(post.publishedAt || post.createdAt)} · {post._count.reactions} تفاعل · {post._count.comments} تعليق</small>
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </section>

        <section className="search-result-stack" aria-live="polite">
          <SectionHeading title="مجتمعات متاحة" action={<Link href="/communities" className="button outline small">كل المجتمعات</Link>} />
          {communitiesQuery.isLoading ? (
            <ExploreState icon={<LoaderCircle className="animate-spin" size={28} />} title="يجري تحميل المجتمعات…" text="نحمّل المجتمعات المنشأة في يمنا." />
          ) : communitiesQuery.isError ? (
            <ExploreState icon={<WifiOff size={28} />} title="تعذر تحميل المجتمعات" text="تحقق من اتصالك ثم أعد المحاولة." />
          ) : communities.length === 0 ? (
            <ExploreState icon={<UsersRound size={28} />} title="لا توجد مجتمعات بعد" text="ستظهر المجتمعات هنا عندما ينشئها الأعضاء." />
          ) : (
            <div className="search-result-stack">
              {communities.map((community) => (
                <Surface className="universal-result image-result" key={community.id}>
                  {community.coverUrl ? <img src={community.coverUrl} alt="" /> : <span className="notification-icon"><UsersRound size={19} /></span>}
                  <div>
                    <b>{community.name}</b>
                    {community.description ? <p>{community.description}</p> : <p>مجتمع {community.visibility === "PRIVATE" ? "خاص" : "عام"} على يمنا</p>}
                    <small>{community._count?.members ?? 0} عضو</small>
                  </div>
                  <Link href={`/communities?community=${encodeURIComponent(community.slug)}`} className="button outline small">استكشاف</Link>
                </Surface>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
