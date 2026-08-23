import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Lock, Send, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/yemna/AppShell";
import { Surface } from "@/components/yemna/UI";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { ApiError, api, type CreateCommunityPayload } from "@/lib/api";
import "./live-community-create.css";

const slugPattern = /^[a-z0-9-]{3,80}$/;

/**
 * نموذج إنشاء مجتمع متصل بعقد POST /api/v1/communities فقط. لا ينشئ حالة محلية
 * أو رابطاً قبل قبول الخادم للطلب وعودة معرّف المجتمع الجديد.
 */
export function LiveCommunityCreatePage() {
  const { currentUser, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CreateCommunityPayload["visibility"]>("PUBLIC");

  const createCommunity = useMutation({
    mutationFn: api.createCommunity,
    onSuccess: async (community) => {
      await queryClient.invalidateQueries({ queryKey: ["rest", "communities"] });
      toast.success("تم إنشاء المجتمع");
      navigate(`/community/${encodeURIComponent(community.id)}`);
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "تعذر إنشاء المجتمع، حاول لاحقاً.";
      toast.error(message);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedSlug = slug.trim().toLowerCase();
    const normalizedDescription = description.trim();

    if (normalizedName.length < 2) {
      toast.error("اكتب اسم مجتمع من حرفين على الأقل.");
      return;
    }
    if (!slugPattern.test(normalizedSlug)) {
      toast.error("اكتب رابطاً قصيراً من أحرف إنجليزية صغيرة أو أرقام أو شرطات فقط.");
      return;
    }

    createCommunity.mutate({
      name: normalizedName,
      slug: normalizedSlug,
      description: normalizedDescription || undefined,
      visibility,
    });
  };

  if (isLoading) {
    return <AppShell title="إنشاء مجتمع"><main className="live-community-create-page"><Surface className="community-create-state"><LoaderCircle className="animate-spin" size={28}/><p>يجري التحقق من جلسة الحساب…</p></Surface></main></AppShell>;
  }

  if (!currentUser) {
    return <AppShell title="إنشاء مجتمع"><main className="live-community-create-page"><Surface className="community-create-state"><Lock size={28}/><h1>سجّل الدخول لإنشاء مجتمع</h1><p>لا نرسل طلب إنشاء ولا نحجز اسماً قبل توفر جلسة صالحة لحسابك.</p><Link className="button" href="/login">تسجيل الدخول</Link></Surface></main></AppShell>;
  }

  return (
    <AppShell title="إنشاء مجتمع">
      <main className="live-community-create-page">
        <Surface className="community-create-hero">
          <span className="eyebrow">مجتمعات يمنا</span>
          <h1>أنشئ مساحة تجمع الناس حول اهتمام مشترك.</h1>
          <p>سيصبح حسابك مدير المجتمع، وسيضاف إليك كأول عضو بعد نجاح الحفظ في الخادم.</p>
        </Surface>

        <Surface className="community-create-form-card">
          <div className="community-create-form-heading">
            <i aria-hidden="true"><Users size={20}/></i>
            <div><h2>بيانات المجتمع</h2><p>الحقول المعلّمة مطلوبة، ويمكن تعديل الوصف لاحقاً عند توفر إدارة المجتمع.</p></div>
          </div>
          <form onSubmit={submit} noValidate>
            <label htmlFor="community-create-name">اسم المجتمع <b aria-hidden="true">*</b></label>
            <input id="community-create-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} minLength={2} autoComplete="off" placeholder="مثال: مجتمع قراءة يمني" required/>

            <label htmlFor="community-create-slug">الرابط القصير <b aria-hidden="true">*</b></label>
            <div className="community-slug-field"><span aria-hidden="true">/community/</span><input id="community-create-slug" value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} maxLength={80} minLength={3} pattern="[a-z0-9-]{3,80}" dir="ltr" autoComplete="off" aria-describedby="community-slug-help" placeholder="yemen-reading" required/></div>
            <p id="community-slug-help" className="community-field-help">استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط. يجب أن يكون فريداً.</p>

            <label htmlFor="community-create-description">وصف مختصر <span>اختياري</span></label>
            <textarea id="community-create-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} placeholder="ما الذي يجمع أعضاء هذا المجتمع؟" rows={5}/>

            <fieldset>
              <legend>خصوصية المجتمع</legend>
              <label className="community-visibility-option"><input type="radio" name="community-visibility" value="PUBLIC" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")}/><span><strong>عام</strong><small>يظهر في البحث ويمكن للجميع الاطلاع على معلوماته.</small></span></label>
              <label className="community-visibility-option"><input type="radio" name="community-visibility" value="PRIVATE" checked={visibility === "PRIVATE"} onChange={() => setVisibility("PRIVATE")}/><span><strong>خاص</strong><small>يُحفظ كخيار خصوصية في الخادم؛ سيعتمد الوصول التفصيلي على سياسات الإدارة المتاحة.</small></span></label>
            </fieldset>

            <div className="community-create-actions"><Link className="button ghost" href="/communities">إلغاء</Link><button className="button" type="submit" disabled={createCommunity.isPending}><Send size={17}/>{createCommunity.isPending ? "جارٍ إنشاء المجتمع…" : "إنشاء المجتمع"}</button></div>
          </form>
        </Surface>
      </main>
    </AppShell>
  );
}
