import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, ImageUp, LoaderCircle, Lock, Save, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AppShell } from "@/components/yemna/AppShell";
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from "@/contexts/CurrentUserContext";
import { api, ApiError, type ApiUser } from "@/lib/api";
import { compressImageForUpload } from "@/lib/media";
import "./live-profile-edit.css";

type ProfileFields = { displayName: string; fullName: string; username: string; bio: string; city: string; governorate: string };

function initialFrom(user?: ApiUser): ProfileFields {
  return {
    displayName: user?.displayName || user?.fullName || "",
    fullName: user?.fullName || "",
    username: user?.username || "",
    bio: user?.bio || "",
    city: user?.city || "",
    governorate: user?.governorate || "",
  };
}

export function LiveProfileEditPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { currentUser, isAuthenticated, isLoading: sessionLoading, setCurrentUser } = useCurrentUser();
  const profileQuery = useQuery({ queryKey: CURRENT_USER_QUERY_KEY, queryFn: api.getMe, enabled: isAuthenticated, retry: 1 });
  const account = profileQuery.data ?? currentUser;
  const [fields, setFields] = useState<ProfileFields>(() => initialFrom(account ?? undefined));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (account) setFields(initialFrom(account)); }, [account]);
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const initials = useMemo(() => (fields.displayName || fields.fullName || "ي").trim().slice(0, 1), [fields.displayName, fields.fullName]);
  const updateProfile = useMutation({
    mutationFn: api.updateMe,
    onSuccess: async updated => {
      setCurrentUser(updated);
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, updated);
      toast.success("تم حفظ بيانات الملف الشخصي");
      navigate("/profile");
    },
    onError: error => toast.error(error instanceof ApiError ? error.message : "تعذر حفظ البيانات، حاول لاحقاً"),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    if (fields.displayName.trim().length < 2) { toast.error("أدخل اسماً لا يقل عن حرفين"); return; }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(fields.username.trim())) { toast.error("اسم المستخدم من 3–30 حرفاً إنجليزياً أو رقماً أو شرطة سفلية"); return; }
    try {
      let avatarUrl = account.avatarUrl || undefined;
      if (avatarFile) {
        setUploading(true);
        const image = await compressImageForUpload(avatarFile);
        avatarUrl = (await api.uploadMedia(image)).publicUrl;
      }
      updateProfile.mutate({ ...fields, displayName: fields.displayName.trim(), fullName: fields.fullName.trim() || undefined, username: fields.username.trim(), bio: fields.bio.trim() || undefined, city: fields.city.trim() || undefined, governorate: fields.governorate.trim() || undefined, avatarUrl: avatarUrl || undefined });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "تعذر رفع الصورة الرمزية، حاول لاحقاً");
    } finally {
      setUploading(false);
    }
  };

  if (sessionLoading) return <AppShell title="تعديل الملف الشخصي"><section className="live-profile-editor-state"><LoaderCircle className="animate-spin" size={28}/><p>يجري التحقق من جلسة الحساب…</p></section></AppShell>;
  if (!isAuthenticated) return <AppShell title="تعديل الملف الشخصي"><section className="live-profile-editor-state"><Lock size={28}/><h2>سجّل الدخول لتعديل ملفك</h2><p>يلزم حسابك لتحديث البيانات والصورة الرمزية.</p><Link className="button" href="/login">تسجيل الدخول</Link></section></AppShell>;
  if (profileQuery.isLoading && !account) return <AppShell title="تعديل الملف الشخصي"><section className="live-profile-editor-state"><LoaderCircle className="animate-spin" size={28}/><p>يجري تحميل بيانات الملف…</p></section></AppShell>;
  if (profileQuery.isError || !account) return <AppShell title="تعديل الملف الشخصي"><section className="live-profile-editor-state"><CircleAlert size={28}/><h2>تعذر تحميل بيانات الملف</h2><p>تحقق من اتصالك ثم أعد المحاولة.</p><button type="button" className="button outline" onClick={() => profileQuery.refetch()}>إعادة المحاولة</button></section></AppShell>;

  const preview = avatarPreview || account.avatarUrl || "";
  const busy = uploading || updateProfile.isPending;
  return <AppShell title="تعديل الملف الشخصي"><main className="live-profile-editor">
    <header className="live-profile-editor-head"><span className="eyebrow">حسابك في يمنا</span><h1>تعديل الملف الشخصي</h1><p>تُحفظ التغييرات في حسابك وتُحدّث بياناتك الظاهرة في التنقل والملف الشخصي.</p></header>
    <form onSubmit={submit} className="live-profile-editor-form">
      <section className="live-profile-avatar-field"><div className="live-profile-avatar">{preview ? <img src={preview} alt="معاينة الصورة الرمزية"/> : <span aria-hidden="true">{initials}</span>}</div><label className="live-profile-upload"><span><ImageUp size={19}/> الصورة الرمزية</span><small>اختر ملف صورة من جهازك. تُرفع الصورة أولاً ثم تُربط بملفك.</small><input aria-label="اختيار صورة رمزية" type="file" accept="image/*" disabled={busy} onChange={event => setAvatarFile(event.target.files?.[0] || null)}/></label></section>
      <div className="live-profile-editor-grid"><label>الاسم الظاهر<input required minLength={2} maxLength={80} value={fields.displayName} disabled={busy} onChange={event => setFields(previous => ({ ...previous, displayName: event.target.value }))}/></label><label>الاسم الكامل <span className="live-profile-optional">اختياري</span><input maxLength={80} value={fields.fullName} disabled={busy} onChange={event => setFields(previous => ({ ...previous, fullName: event.target.value }))}/></label><label>اسم المستخدم<input required pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} dir="ltr" value={fields.username} disabled={busy} onChange={event => setFields(previous => ({ ...previous, username: event.target.value }))}/><small>يُستخدم في رابط ملفك العام.</small></label><label>المدينة <span className="live-profile-optional">اختياري</span><input maxLength={120} value={fields.city} disabled={busy} onChange={event => setFields(previous => ({ ...previous, city: event.target.value }))}/></label><label>المحافظة <span className="live-profile-optional">اختياري</span><input maxLength={120} value={fields.governorate} disabled={busy} onChange={event => setFields(previous => ({ ...previous, governorate: event.target.value }))}/></label></div>
      <label className="live-profile-bio">النبذة <span className="live-profile-optional">اختياري</span><textarea rows={5} maxLength={500} value={fields.bio} disabled={busy} placeholder="عرّف مجتمع يمنا بك باختصار" onChange={event => setFields(previous => ({ ...previous, bio: event.target.value }))}/><small>{fields.bio.length}/500</small></label>
      <footer className="live-profile-editor-actions"><Link className="button ghost" href="/profile">إلغاء</Link><button className="button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" size={17}/>{uploading ? "جارٍ رفع الصورة…" : "جارٍ الحفظ…"}</> : <><Save size={17}/>حفظ التغييرات</>}</button></footer>
    </form>
  </main></AppShell>;
}
