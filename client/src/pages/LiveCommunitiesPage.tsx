import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { SectionHeading, Surface } from "@/components/yemna/UI";
import { api, hasRestSession } from "@/lib/api";

function CommunityEmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="content-placeholder community-empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

/**
 * صفحة المجتمعات الإنتاجية. جميع البطاقات والأعداد القادمة من API، ولا تعرض
 * تقديرات جاهزة أو أزراراً لا تنفذ إجراءً حقيقياً.
 */
export function LiveCommunitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const authenticated = hasRestSession();
  const communitiesQuery = useQuery({
    queryKey: ["rest", "communities"],
    queryFn: api.getCommunities,
    retry: 1,
  });

  const visibleCommunities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ar");
    const communities = Array.isArray(communitiesQuery.data) ? communitiesQuery.data : [];

    if (!normalizedSearch) return communities;
    return communities.filter((community) =>
      `${community.name} ${community.description ?? ""}`.toLocaleLowerCase("ar").includes(normalizedSearch),
    );
  }, [communitiesQuery.data, search]);

  const joinCommunity = useMutation({
    mutationFn: (communityId: string) => api.joinCommunity(communityId),
    onSuccess: (_result, communityId) => {
      setJoinedIds((current) => (current.includes(communityId) ? current : [...current, communityId]));
      void queryClient.invalidateQueries({ queryKey: ["rest", "communities"] });
      toast.success("تم الانضمام إلى المجتمع");
    },
    onError: () => toast.error("تعذر الانضمام إلى المجتمع، حاول مجدداً."),
  });

  const requestJoin = (communityId: string) => {
    if (!authenticated) {
      toast.error("سجّل الدخول أولاً للانضمام إلى مجتمع.");
      return;
    }
    joinCommunity.mutate(communityId);
  };

  return (
    <AppShell title="المجموعات والمجتمعات">
      <main className="communities-page live-communities-page">
        <Surface className="community-hero live-communities-hero">
          <div>
            <span className="eyebrow">مجتمعات يمنا</span>
            <h1>اكتشف مجتمعات حقيقية تناسب اهتماماتك.</h1>
            <p>تُعرض هنا المجتمعات المنشأة في يمنا وعدد أعضائها الفعلي.</p>
          </div>
          <Users aria-hidden="true" size={42} strokeWidth={1.5} />
        </Surface>

        <Surface className="live-communities-search" aria-label="البحث في المجتمعات">
          <label htmlFor="community-search">ابحث في المجتمعات</label>
          <input
            id="community-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="اكتب اسم المجتمع أو وصفه"
            type="search"
          />
        </Surface>

        <section className="live-communities-list" aria-live="polite">
          <SectionHeading title={search.trim() ? "نتائج البحث" : "كل المجتمعات"} />
          {communitiesQuery.isLoading ? (
            <div className="content-placeholder">
              <LoaderCircle className="animate-spin" size={28} />
              <p>يجري تحميل المجتمعات…</p>
            </div>
          ) : communitiesQuery.isError ? (
            <CommunityEmptyState
              icon={<WifiOff />}
              title="تعذر تحميل المجتمعات"
              text="تحقق من اتصالك ثم أعد المحاولة."
            />
          ) : visibleCommunities.length === 0 ? (
            <CommunityEmptyState
              icon={<Users />}
              title={search.trim() ? "لا توجد نتائج مطابقة" : "لا توجد مجتمعات بعد"}
              text={search.trim() ? "جرّب عبارة بحث أخرى." : "ستظهر المجتمعات هنا عندما ينشئها الأعضاء."}
            />
          ) : (
            <div className="community-cards live-community-cards">
              {visibleCommunities.map((community) => {
                const joined = joinedIds.includes(community.id);
                const memberCount = community._count?.members ?? 0;

                return (
                  <Surface className="community-card" key={community.id}>
                    {community.coverUrl ? (
                      <img src={community.coverUrl} alt="" />
                    ) : (
                      <div className="community-art" aria-hidden="true">
                        <Users size={31} />
                      </div>
                    )}
                    <div className="community-card-body">
                      <span>{community.visibility === "PRIVATE" ? "مجتمع خاص" : "مجتمع عام"}</span>
                      <h2>{community.name}</h2>
                      {community.description ? <p>{community.description}</p> : null}
                      <small>{memberCount} عضو</small>
                      <button
                        className={joined ? "button secondary" : "button"}
                        disabled={joined || joinCommunity.isPending}
                        onClick={() => requestJoin(community.id)}
                        type="button"
                      >
                        {joined ? "تم الانضمام" : "انضمام"}
                      </button>
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
