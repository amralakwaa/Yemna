import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const yemnaPages = readFileSync(resolve(import.meta.dirname, "../client/src/pages/YemnaPages.tsx"), "utf8");
const socialSuite = readFileSync(resolve(import.meta.dirname, "../client/src/pages/SocialSuite.tsx"), "utf8");
const liveCommunities = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveCommunitiesPage.tsx"), "utf8");
const app = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
const appShell = readFileSync(resolve(import.meta.dirname, "../client/src/components/yemna/AppShell.tsx"), "utf8");
const referenceSuite = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ReferenceSuite.tsx"), "utf8");
const referenceSuiteStyles = readFileSync(resolve(import.meta.dirname, "../client/src/reference-suite.css"), "utf8");
const privateProfileCollections = readFileSync(resolve(import.meta.dirname, "../client/src/pages/PrivateProfileCollectionsPage.tsx"), "utf8");
const liveDataUnavailable = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveDataUnavailablePage.tsx"), "utf8");
const styles = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

describe("live social data contract", () => {
  it("loads the home rail from REST communities and friends instead of fabricated trends", () => {
    const trendRail = yemnaPages.split("function TrendRail() {")[1].split("export function HomePage")[0];

    expect(trendRail).toContain("queryFn:api.getCommunities");
    expect(trendRail).toContain("queryFn:api.getFriends");
    expect(trendRail).not.toContain("صنعاء الجميلة");
    expect(trendRail).not.toContain("معرض الكتاب اليمني");
  });

  it("loads the group directory from the communities API and exposes honest empty states", () => {
    const directory = socialSuite.split("export function DirectoryPage(){")[1].split("export function CreatePageEntity")[0];

    expect(directory).toContain("queryFn:api.getCommunities");
    expect(directory).toContain("queryFn:api.getMyCommunities");
    expect(directory).toContain("سجّل الدخول لعرض مجموعاتك");
    expect(directory).toContain("لم تنضم إلى أي مجتمع بعد");
    expect(directory).toContain("لا توجد مجموعات مطابقة");
    expect(directory).toContain('تعذر تحميل {tab==="joined"?"مجموعاتك":"المجموعات"}');
    expect(directory).not.toContain("ملتقى اليمن للتقنية");
    expect(directory).not.toContain("مؤسسة روّاد التعليم");
  });

  it("keeps the production communities route REST-backed without fabricated location cards", () => {
    expect(app).toContain('<Route path="/communities" component={LiveCommunitiesPage}/>');
    expect(liveCommunities).toContain("queryFn: api.getCommunities");
    expect(liveCommunities).toContain("api.joinCommunity");
    expect(liveCommunities).toContain("community._count?.members ?? 0");
    expect(liveCommunities).toContain("لا توجد مجتمعات بعد");
    expect(liveCommunities).not.toContain("صنعاء الجميلة");
    expect(liveCommunities).not.toContain("اكتشف مجتمعاً قريباً منك");
  });

  it("gates the feed and stories behind a real session and gives guests an honest state", () => {
    const stories = yemnaPages.split("function Stories() {")[1].split("const MAX_VIDEO_BYTES")[0];
    const home = yemnaPages.split("export function HomePage() {")[1].split("export function LoginPage")[0];

    expect(stories).toContain("enabled: isAuthenticated");
    expect(stories).toContain("سجّل الدخول لمشاهدة قصص المجتمع");
    expect(home).toContain("enabled: isAuthenticated");
    expect(home).toContain("سجّل الدخول لمتابعة مجتمع يمنا");
    expect(home).toContain("!isSessionLoading && !isAuthenticated");
  });

  it("does not present unimplemented composer actions as active features", () => {
    const composer = yemnaPages.split("function Composer(")[1].split("function TrendRail")[0];

    expect(composer).toContain('disabled aria-label="المشاعر والنشاط غير متاحين بعد"');
    expect(composer).toContain('disabled aria-label="مشاركة الموقع غير متاحة بعد"');
    expect(styles).toContain('.composer-actions button:disabled:not(.button)');
  });

  it("does not present reference-only discovery, Reels, or live routes as live data", () => {
    expect(app).toContain("const liveDataUnavailableRoutes =");
    expect(app).toContain('component={LiveDataUnavailablePage}');
    expect(liveDataUnavailable).toContain("قيد الربط بمصدر بيانات حقيقي");
    expect(liveDataUnavailable).not.toContain("12.4K");
    expect(liveDataUnavailable).not.toContain("1.3K");
  });

  it("does not route reference-only account, support, messaging, or community details to fabricated screens", () => {
    expect(app).toContain('<Route path="/help" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/account" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/messages/new" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/community/members" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('profileCollectionsWithoutLiveData = profileCollections');
    expect(liveDataUnavailable).toContain('"/account/delete": "حذف الحساب"');
  });

  it("never renders the fabricated saved-media grid for guests", () => {
    expect(appShell).toContain('const isSavedPage = location === "/saved"');
    expect(appShell).toContain('isSavedPage ? "المحفوظات" : "تفاعلاتك"');
    expect(appShell).toContain("لا توجد عناصر محفوظة حقيقية بعد");
    expect(appShell).toContain("{pageContent}");
  });

  it("never renders fabricated activity history before a session exists", () => {
    expect(appShell).toContain('const isActivityPage = location === "/activity"');
    expect(appShell).toContain("سجّل الدخول لعرض {isSavedPage ? \"المحفوظات\" : \"تفاعلاتك\"}");
    expect(appShell).toContain("لا توجد تفاعلات حقيقية بعد");
  });

  it("gives guest visitors an explicit authentication state on personal relationship lists", () => {
    expect(appShell).toContain('const isRelationAccountPage = ["/friend-requests", "/followers", "/following", "/blocked"].includes(location);');
    expect(appShell).toContain("const isGuestRelationPage = isRelationAccountPage && !isCurrentUserLoading && !currentUser;");
    expect(appShell).toContain('سجّل الدخول لعرض {title || "علاقاتك"}');
    expect(appShell).toContain("تحتاج قوائم العلاقات والطلبات إلى حسابك في يمنا.");
  });

  it("protects the personal media creation route and does not leave it usable for guests", () => {
    expect(appShell).toContain('const isGuestMediaCreatePage = location === "/create/media" && !isCurrentUserLoading && !currentUser;');
    expect(appShell).toContain("سجّل الدخول لرفع الوسائط");
    expect(referenceSuite).toContain('path === "/albums" && <Link href="/create/media"');
    expect(referenceSuiteStyles).toContain('.app-shell--guest .collection-page .collection-intro a[href="/create/media"]{display:none}');
  });

  it("does not expose account settings controls to guests", () => {
    expect(appShell).toContain('const isSettingsAuthPending = isSettingsPage && isCurrentUserLoading;');
    expect(appShell).toContain('const isGuestSettingsPage = isSettingsPage && !isCurrentUserLoading && !currentUser;');
    expect(appShell).toContain("لن تظهر إعدادات الحساب قبل التحقق من تسجيل الدخول.");
    expect(appShell).toContain("سجّل الدخول لإدارة الإعدادات");
    expect(appShell).toContain("لتعديل الخصوصية والأمان وتفضيلات الحساب");
  });

  it("does not present fabricated posts, saves, activity, or memories as account data", () => {
    expect(app).toContain("profileCollectionsWithoutLiveData.includes(path) ? PrivateProfileCollectionsPage : ProfileCollectionPage");
    expect(privateProfileCollections).toContain("سجّل الدخول لعرض {details.title}");
    expect(privateProfileCollections).toContain("لن نعرض عناصر تجريبية مكان بيانات حسابك");
    expect(privateProfileCollections).not.toContain("أعجبت بمنشور عن صنعاء القديمة");
    expect(privateProfileCollections).not.toContain("gallery.concat");
  });
});
