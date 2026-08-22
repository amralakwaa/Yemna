import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, LoaderCircle, Lock, Play, Plus, Trash2, Video, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { Pill, SectionHeading, Surface } from "@/components/yemna/UI";
import { api, hasRestSession, type ApiMediaAsset } from "@/lib/api";

type MediaFilter = "ALL" | "IMAGE" | "VIDEO";

function MediaState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <Surface className="content-placeholder"><span>{icon}</span><h2>{title}</h2><p>{text}</p></Surface>;
}

/**
 * مكتبة الوسائط الإنتاجية: تعرض أصول الحساب وألبوماته من واجهة REST فقط.
 * لا تضم Reels أو قصصاً أو منشورات مثالاً لأن لكل منها عقد بيانات مستقل غير متاح هنا.
 */
export function LiveMediaPage() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const authenticated = hasRestSession();
  const [filter, setFilter] = useState<MediaFilter>("ALL");
  const kind = filter === "ALL" ? undefined : filter;
  const media = useQuery({ queryKey: ["rest", "media", kind ?? "all"], queryFn: () => api.getMedia(kind), enabled: authenticated, retry: 1 });
  const albums = useQuery({ queryKey: ["rest", "media", "albums"], queryFn: api.getMediaAlbums, enabled: authenticated, retry: 1 });
  const remove = useMutation({
    mutationFn: api.deleteMedia,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rest", "media"] });
      toast.success("تم حذف الوسيط من مكتبتك");
    },
    onError: () => toast.error("تعذر حذف الوسيط، حاول مجدداً."),
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadMedia(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rest", "media"] });
      toast.success("تم رفع الوسيط إلى مكتبتك");
    },
    onError: () => toast.error("تعذر رفع الوسيط، حاول مجدداً."),
  });

  const selectFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("يمكن رفع الصور أو الفيديوهات فقط.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 25 ميغابايت.");
      return;
    }
    upload.mutate(file);
  };

  const renderAsset = (asset: ApiMediaAsset) => (
    <article className="media-thumb" key={asset.id}>
      {asset.kind === "VIDEO" ? (
        <video src={asset.publicUrl} controls playsInline preload="metadata" aria-label="فيديو من مكتبتك" />
      ) : (
        <img src={asset.publicUrl} alt="صورة من مكتبتك" loading="lazy" />
      )}
      {asset.kind === "VIDEO" ? <span className="media-kind"><Play fill="currentColor" size={15} /> فيديو</span> : null}
      <button
        type="button"
        className="float-save"
        aria-label="حذف الوسيط"
        disabled={remove.isPending}
        onClick={() => remove.mutate(asset.id)}
      >
        <Trash2 size={16} />
      </button>
    </article>
  );

  return (
    <AppShell title="الوسائط والمحتوى">
      <main className="media-page live-media-page">
        <Surface className="media-tabs">
          <div aria-label="تصفية مكتبة الوسائط">
            <Pill active={filter === "ALL"} onClick={() => setFilter("ALL")}>الكل</Pill>
            <Pill active={filter === "IMAGE"} onClick={() => setFilter("IMAGE")}>الصور</Pill>
            <Pill active={filter === "VIDEO"} onClick={() => setFilter("VIDEO")}>الفيديو</Pill>
          </div>
          {authenticated ? (
            <>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="image/*,video/*"
                onChange={(event) => {
                  selectFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <button type="button" className="button" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                <Plus size={16} />{upload.isPending ? "جارٍ الرفع…" : "رفع وسيط"}
              </button>
            </>
          ) : <Link href="/login" className="button"><Lock size={16} />تسجيل الدخول</Link>}
        </Surface>

        {!authenticated ? (
          <MediaState icon={<Lock size={30} />} title="سجّل الدخول لعرض مكتبتك" text="تحتاج صورك وفيديوهاتك وألبوماتك إلى حسابك في يمنا." />
        ) : media.isLoading ? (
          <MediaState icon={<LoaderCircle className="animate-spin" size={30} />} title="يجري تحميل مكتبتك" text="نحمّل صورك وفيديوهاتك من مصدر البيانات." />
        ) : media.isError ? (
          <MediaState icon={<WifiOff size={30} />} title="تعذر تحميل الوسائط" text="تحقق من اتصالك ثم أعد المحاولة." />
        ) : media.data?.length ? (
          <section aria-label="عناصر مكتبة الوسائط" className="media-grid">{media.data.map(renderAsset)}</section>
        ) : (
          <MediaState
            icon={filter === "VIDEO" ? <Video size={30} /> : <ImageIcon size={30} />}
            title={filter === "ALL" ? "لا توجد وسائط بعد" : filter === "VIDEO" ? "لا توجد فيديوهات بعد" : "لا توجد صور بعد"}
            text="ارفع صوراً أو فيديوهات لتظهر هنا." 
          />
        )}

        {authenticated ? (
          <Surface className="media-post live-media-albums">
            <SectionHeading title="ألبوماتي" />
            {albums.isLoading ? <p>يجري تحميل الألبومات…</p> : albums.isError ? <p>تعذر تحميل الألبومات.</p> : albums.data?.length ? (
              <div className="small-gallery">
                {albums.data.map((album) => <div key={album.id}>{album.coverUrl ? <img src={album.coverUrl} alt="" /> : null}<b>{album.title}</b><small>{album._count.assets} عناصر</small></div>)}
              </div>
            ) : <p>لم تنشئ ألبومات بعد.</p>}
          </Surface>
        ) : null}
      </main>
    </AppShell>
  );
}
