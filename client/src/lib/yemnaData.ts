/** يمنا: بيانات عرض عربية مركزية، متسقة مع مرجعية واجهة اجتماعية يمنية RTL. */
export type Person = { id: number; name: string; handle: string; avatar: string; online?: boolean; mutual?: number; verified?: boolean; userId?: string; username?: string | null };
export type Post = { id: string | number; author: Person; group?: string; time: string; text: string; image?: string; mediaKind?: "IMAGE" | "VIDEO"; reactions: number; comments: number; shares: number; saved?: boolean; media?: number };

export const assets = {
  campus: "/manus-storage/yemna-feed-ai-campus_ee5d1644.jpg",
  sanaa: "/manus-storage/yemna-sanaa-community_80821301.jpg",
  socotra: "/manus-storage/yemna-socotra-discovery_8d9ad492.jpg",
  mark: "/manus-storage/yemna-logo-mark_dedd38c9.png",
};

export const people: Person[] = [
  { id: 1, name: "عمر بلال الأكوع", handle: "@omar.alkooe", avatar: "https://i.pravatar.cc/160?img=12", online: true, mutual: 18, verified: true },
  { id: 2, name: "سارة القاضي", handle: "@sara.alqadi", avatar: "https://i.pravatar.cc/160?img=47", online: true, mutual: 12 },
  { id: 3, name: "محمد الحاج", handle: "@mohammed.alhaj", avatar: "https://i.pravatar.cc/160?img=33", online: false, mutual: 7 },
  { id: 4, name: "رحمة علي", handle: "@rahma.ali", avatar: "https://i.pravatar.cc/160?img=45", online: true, mutual: 4 },
  { id: 5, name: "أحمد الحداد", handle: "@ahmed.alhaddad", avatar: "https://i.pravatar.cc/160?img=11", online: false, mutual: 19 },
  { id: 6, name: "نور الزبيري", handle: "@noor.alzubairy", avatar: "https://i.pravatar.cc/160?img=32", online: true, mutual: 3 },
];

export const communities = [
  { id: 1, name: "مجتمع صنعاء", count: "25K عضو", image: assets.sanaa, type: "مجتمع محلي" },
  { id: 2, name: "تقنية المعلومات - صنعاء", count: "18K عضو", image: assets.campus, type: "مجموعة" },
  { id: 3, name: "مجتمع تعز", count: "14K عضو", image: assets.socotra, type: "مجتمع محلي" },
  { id: 4, name: "مبادرات اليمن", count: "6.4K عضو", image: "", type: "مجتمع محلي" },
];

export const posts: Post[] = [
  { id: 1, author: { ...people[0] }, group: "جامعة صنعاء", time: "منذ ساعة واحدة", text: "ضمن فعاليات الأنشطة الطلابية، أقمنا اليوم ورشة عمل حول الذكاء الاصطناعي وتطبيقاته في التعليم. مشاركة واسعة من الطلاب والمهتمين كانت مصدر إلهام للجميع.", image: assets.campus, reactions: 256, comments: 32, shares: 18 },
  { id: 2, author: { ...people[1] }, group: "مجتمع صنعاء", time: "منذ 3 ساعات", text: "من أزقة صنعاء القديمة إلى أفقها الهادئ، لكل مكان هنا قصة تستحق أن تُروى. ما أجمل مدينتنا حين نجتمع حول ما نحب.", image: assets.sanaa, reactions: 128, comments: 24, shares: 9 },
  { id: 3, author: { ...people[2] }, group: "رحلات اليمن", time: "أمس", text: "رحلة قصيرة إلى طبيعة اليمن المدهشة. شاركونا الأماكن التي تتمنون زيارتها في عطلتكم القادمة.", image: assets.socotra, reactions: 89, comments: 12, shares: 6 },
];

export const navItems = [
  { key: "home", label: "الرئيسية", path: "/", icon: "House" },
  { key: "friends", label: "الأصدقاء", path: "/friends", icon: "Users" },
  { key: "groups", label: "المجموعات", path: "/communities", icon: "UsersRound" },
  { key: "content", label: "المحتوى", path: "/media", icon: "PlaySquare" },
  { key: "alerts", label: "الإشعارات", path: "/notifications", icon: "Bell", badge: 3 },
  { key: "messages", label: "الرسائل", path: "/messages", icon: "MessageCircle", badge: 2 },
];

export const settingsGroups = [
  { title: "الحساب", items: ["معلومات شخصية", "كلمة المرور", "الخصوصية", "الإشعارات", "اللغة والمنطقة"] },
  { title: "الأمان", items: ["التحقق بخطوتين", "الجلسات والأجهزة", "المحظورون", "تنزيل بياناتك"] },
  { title: "الدعم", items: ["مركز الخصوصية", "المساعدة والدعم", "الإبلاغ عن مشكلة", "تسجيل الخروج"] },
];
