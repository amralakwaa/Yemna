import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const yemnaPages = readFileSync(resolve(import.meta.dirname, "../client/src/pages/YemnaPages.tsx"), "utf8");
const socialSuite = readFileSync(resolve(import.meta.dirname, "../client/src/pages/SocialSuite.tsx"), "utf8");
const liveCommunities = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveCommunitiesPage.tsx"), "utf8");
const liveCommunityCreate = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveCommunityCreatePage.tsx"), "utf8");
const liveCommunityDetail = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveCommunityDetailPage.tsx"), "utf8");
const liveExplore = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveExplorePage.tsx"), "utf8");
const liveSearch = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveSearchPage.tsx"), "utf8");
const liveRelationships = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveRelationshipsPage.tsx"), "utf8");
const liveProfileEdit = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveProfileEditPage.tsx"), "utf8");
const liveAccount = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveAccountPage.tsx"), "utf8");
const liveSupport = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveSupportPage.tsx"), "utf8");
const liveAdmin = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveAdminPage.tsx"), "utf8");
const liveAssistant = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveAssistantPage.tsx"), "utf8");
const liveMedia = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveMediaPage.tsx"), "utf8");
const realtimePages = readFileSync(resolve(import.meta.dirname, "../client/src/pages/RealtimePages.tsx"), "utf8");
const restApi = readFileSync(resolve(import.meta.dirname, "../client/src/lib/api.ts"), "utf8");
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

  it("reopens only REST-backed post and community detail routes", () => {
    expect(app).toContain('<Route path="/post/:id" component={PostDetailPage}/>');
    expect(referenceSuite).toContain('api.getPost(postId || "")');
    expect(referenceSuite).toContain('api.getPostComments(postId || "")');
    expect(referenceSuite).toContain('api.createPostComment(postId || "", body)');
    expect(app).toContain('<Route path="/community/:id/members" component={LiveCommunityMembersPage}/>');
    expect(app).toContain('<Route path="/community/:id" component={LiveCommunityDetailPage}/>');
    expect(restApi).toContain('getCommunity: (communityId: string)');
    expect(restApi).toContain('getCommunityMembers: (communityId: string)');
    expect(liveCommunityDetail).toContain("api.getCommunity(id)");
    expect(liveCommunityDetail).toContain("api.getCommunityMembers(id)");
    expect(liveCommunityDetail).toContain("api.joinCommunity(id)");
    expect(liveCommunityDetail).toContain("api.leaveCommunity(id)");
    expect(liveCommunityDetail).not.toContain("communityMap");
  });

  it("reopens explore only with REST-backed posts and communities while discovery subroutes remain gated", () => {
    expect(app).toContain('import { LiveExplorePage } from "./pages/LiveExplorePage";');
    expect(app).toContain('<Route path="/explore" component={LiveExplorePage}/>');
    expect(liveExplore).toContain("queryFn: api.getFeed");
    expect(liveExplore).toContain("queryFn: api.getCommunities");
    expect(liveExplore).toContain('href="/search"');
    expect(liveExplore).toContain("تعذر تحميل المنشورات");
    expect(liveExplore).toContain("لا توجد مجتمعات بعد");
    expect(liveExplore).not.toContain("const trending");
    expect(liveExplore).not.toContain("#صنعاء");
    expect(liveExplore).not.toContain("12.4K");
    expect(app).toContain('"/discover", "/discover/map", "/discover/interests"');
    expect(appShell).toContain("navItems[6]");
  });

  it("connects live search results directly to the REST-backed post and community detail routes", () => {
    expect(liveSearch).toContain("queryFn: () => api.search(normalized, type)");
    expect(liveSearch).toContain('href={`/post/${encodeURIComponent(post.id)}`}');
    expect(liveSearch).toContain('href={`/community/${encodeURIComponent(community.id)}`}');
    expect(liveSearch).not.toContain('href={`/communities?community=${community.slug}`}');
    expect(app).toContain('<Route path="/post/:id" component={PostDetailPage}/>');
    expect(app).toContain('<Route path="/community/:id" component={LiveCommunityDetailPage}/>');
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

  it("reopens only REST-backed story routes with an explicit guest gate for creation", () => {
    expect(app).toContain('import { LiveStoryCreatePage } from "./pages/LiveStoryCreatePage";');
    expect(app).toContain('<Route path="/story/create" component={LiveStoryCreatePage}/>');
    expect(app).toContain('<Route path="/story/archive" component={StoryArchivePage}/>');
    expect(app).toContain('<Route path="/story/:id" component={StoryPage}/>');
    expect(app).toContain('<Route path="/story" component={StoryPage}/>');
    expect(referenceSuite).toContain('queryFn:api.getStories');
    expect(referenceSuite).toContain('mutationFn:(storyId:string)=>api.recordStoryView(storyId)');
    expect(referenceSuite).toContain('api.replyToStory');
    expect(referenceSuite).toContain('queryFn:api.getStoryArchive');
    expect(referenceSuite).toContain('api.createStory(asset.id,caption.trim() || undefined)');
    expect(restApi).toContain('getStories: () => apiRequest<ApiStory[]>("/stories")');
    expect(restApi).toContain('createStory: (mediaId: string, caption?: string)');
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

  it("opens only the REST-backed assistant while keeping experimental AI tools gated", () => {
    expect(app).toContain('<Route path="/ai" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('import { LiveAssistantPage } from "./pages/LiveAssistantPage";');
    expect(app).toContain('<Route path="/ai/assistant" component={LiveAssistantPage}/>');
    expect(app).toContain('const aiTools = ["/ai/post"');
    expect(app).toContain('{aiTools.map(path=><Route key={path} path={path} component={LiveDataUnavailablePage}/>)}');
    expect(app).toContain('{aiExtras.map(path=><Route key={path} path={path} component={LiveDataUnavailablePage}/>)}');
    expect(app).not.toContain('component={AIHubPage}');
    expect(app).not.toContain('component={AIToolDetailPage}');
    expect(restApi).toContain('chatWithAssistant: (message: string) => apiRequest<ApiAssistantChatResponse>("/assistant/chat"');
    expect(liveAssistant).toContain("api.chatWithAssistant");
    expect(liveAssistant).toContain("سجّل الدخول لاستخدام مساعد يمنا");
    expect(liveAssistant).toContain("لا يملك وصولاً إلى حسابك أو رسائلك أو بياناتك الخاصة");
    expect(liveAssistant).not.toContain("suggestedPrompts");
    expect(appShell).toContain("navItems[7]");
    expect(liveDataUnavailable).toContain('"/ai": "ذكاء يمنا"');
    expect(liveDataUnavailable).toContain('location.startsWith("/ai/") ? "ذكاء يمنا"');
  });

  it("publishes support tickets and content reports only through their live REST contracts", () => {
    expect(app).toContain('import { LiveSupportPage } from "./pages/LiveSupportPage";');
    expect(app).toContain('<Route path="/help" component={LiveSupportPage}/>');
    expect(app).toContain('<Route path="/help/report" component={LiveSupportPage}/>');
    expect(app).toContain('<Route path="/help/report/status" component={LiveSupportPage}/>');
    expect(app).toContain('<Route path="/support/reports" component={LiveSupportPage}/>');
    expect(app).toContain('<Route path="/help/faq" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/help/contact" component={LiveSupportPage}/>');
    expect(liveSupport).toContain("api.getSupportTickets");
    expect(liveSupport).toContain("api.createSupportTicket");
    expect(liveSupport).toContain('location === "/help/report" || location === "/help/contact"');
    expect(liveSupport).toContain("api.getSupportReports");
    expect(liveSupport).toContain("api.createSupportReport");
    expect(liveSupport).toContain("سجّل الدخول للوصول إلى الدعم");
    expect(liveSupport).not.toContain("دردشة مباشرة");
    expect(appShell).toContain('label: "المساعدة والدعم", path: "/help"');
  });

  it("reopens only REST-backed administrative lists behind the server authorization gate", () => {
    expect(app).toContain('import { LiveAdminPage } from "./pages/LiveAdminPage";');
    expect(app).toContain('<Route path="/admin" component={LiveAdminPage}/>');
    expect(app).toContain('<Route path="/admin/users" component={LiveAdminPage}/>');
    expect(app).toContain('<Route path="/admin/tickets" component={LiveAdminPage}/>');
    expect(app).toContain('<Route path="/admin/reports" component={LiveAdminPage}/>');
    expect(liveAdmin).toContain("api.getAdminStats");
    expect(liveAdmin).toContain("api.getAdminUsers");
    expect(liveAdmin).toContain("api.getAdminTickets");
    expect(liveAdmin).toContain("api.getAdminReports");
    expect(liveAdmin).toContain("api.updateAdminUserStatus");
    expect(liveAdmin).toContain("api.updateAdminTicketStatus");
    expect(liveAdmin).toContain("api.updateAdminReportStatus");
    expect(liveAdmin).toContain("لا تملك صلاحية الإدارة");
    expect(liveAdmin).not.toContain("إجمالي الزيارات");
    expect(app).toContain('<Route path="/admin/ai-analytics" component={AdminAccessGuard}/>');
  });

  it("routes only REST-backed account details and profile editing while keeping unsupported account actions honest", () => {
    expect(app).toContain('import { LiveAccountPage } from "./pages/LiveAccountPage";');
    expect(app).toContain('<Route path="/account" component={LiveAccountPage}/>');
    expect(app).toContain('<Route path="/account/info" component={LiveAccountPage}/>');
    expect(app).toContain('<Route path="/account/edit" component={LiveProfileEditPage}/>');
    expect(liveAccount).toContain('queryFn: api.getMe');
    expect(liveAccount).toContain('سجّل الدخول لعرض معلومات حسابك');
    expect(liveAccount).toContain('href="/account/edit"');
    expect(liveAccount).toContain('لا تظهر هنا إجراءات تغيير وسائل الاتصال');
    expect(app).toContain('<Route path="/account/contact/email" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/account/contact/phone" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/account/recovery" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/account/disable" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/account/delete" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/messages/new" component={NewMessagePage}/>');
    expect(app).toContain('<Route path="/groups/create" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('import { LiveCommunityCreatePage } from "./pages/LiveCommunityCreatePage";');
    expect(app).toContain('<Route path="/communities/create" component={LiveCommunityCreatePage}/>');
    expect(app).toContain('<Route path="/community/create" component={LiveCommunityCreatePage}/>');
    expect(liveCommunityCreate).toContain('mutationFn: api.createCommunity');
    expect(liveCommunityCreate).toContain('navigate(`/community/${encodeURIComponent(community.id)}`)');
    expect(liveCommunityCreate).toContain('سجّل الدخول لإنشاء مجتمع');
    expect(restApi).toContain('createCommunity: (payload: CreateCommunityPayload)');
    expect(app).toContain('<Route path="/community/members" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('profileCollections.map(path=><Route key={path} path={path} component={LiveDataUnavailablePage}/>)');
    expect(liveDataUnavailable).toContain('"/account/delete": "حذف الحساب"');
  });

  it("keeps authenticated message creation real and sends guests to a clear login state", () => {
    expect(socialSuite).toContain('queryFn:()=>api.search(term,"users")');
    expect(socialSuite).toContain('mutationFn:()=>api.createConversation(chosen.map(user=>user.id))');
    expect(socialSuite).toContain('if(!signedIn)return <AppShell title="رسالة جديدة">');
    expect(socialSuite).toContain("سجّل الدخول لبدء رسالة جديدة");
    expect(app.indexOf('<Route path="/messages/new" component={NewMessagePage}/>')).toBeLessThan(app.indexOf('<Route path="/messages" component={RealtimeMessagesPage}/>'));
  });

  it("reopens the direct chat entry point with the REST-backed messaging experience", () => {
    expect(app).toContain('<Route path="/messages/chat" component={RealtimeMessagesPage}/>');
    expect(app).not.toContain('<Route path="/messages/chat" component={LiveDataUnavailablePage}/>');
    expect(realtimePages).toContain('queryFn: api.getConversations');
    expect(realtimePages).toContain('api.getConversationMessagesPage');
    expect(realtimePages).toContain('سجّل الدخول للمتابعة');
    expect(app).toContain('<Route path="/messages/info" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/messages/group" component={LiveDataUnavailablePage}/>');
  });

  it("does not expose a fabricated group creation action", () => {
    expect(appShell).toContain("const mobileProtectedAction =");
    expect(appShell).toContain('mobileProtectedAction("/groups/create", "إنشاء مجموعة", <Plus/>, false)');
    expect(appShell).toContain('aria-label={`${label} غير متاح حتى اكتمال ربط مصدر البيانات`}');
  });

  it("hides incomplete saved-media collections instead of rendering a guest placeholder grid", () => {
    expect(app).toContain("profileCollections.map(path=><Route key={path} path={path} component={LiveDataUnavailablePage}/>)");
    expect(appShell).not.toContain('const isSavedPage = location === "/saved"');
    expect(appShell).not.toContain("لا توجد عناصر محفوظة حقيقية بعد");
  });

  it("hides incomplete activity history instead of exposing a guest interaction state", () => {
    expect(app).toContain('const profileCollections = ["/my-posts","/saved","/activity","/memories"];');
    expect(appShell).not.toContain('const isActivityPage = location === "/activity"');
    expect(appShell).not.toContain("لا توجد تفاعلات حقيقية بعد");
  });

  it("reopens only the REST-backed personal photos, videos, and albums", () => {
    expect(app).toContain('ProfileCollectionPage');
    expect(app).toContain('const liveProfileMediaCollections = ["/albums","/photos","/videos"];');
    expect(app).toContain('{liveProfileMediaCollections.map(path=><Route key={path} path={path} component={ProfileCollectionPage}/>)}');
    expect(referenceSuite).toContain('queryFn: () => api.getMedia(mediaKind)');
    expect(referenceSuite).toContain('queryFn: api.getMediaAlbums');
    expect(referenceSuite).toContain('سجّل الدخول لعرض وسائطك');
  });

  it("reopens only REST-backed relationship lists and keeps mutual and generic management routes gated", () => {
    expect(app).toContain('import { LiveRelationshipsPage } from "./pages/LiveRelationshipsPage";');
    expect(app).toContain('const liveRelationshipRoutes = ["/friends", "/friend-requests", "/friend-requests/sent", "/followers", "/following", "/people/discover", "/blocked", "/blocked/unblock", "/friend-suggestions", "/people/suggestions"];');
    expect(app).toContain('{liveRelationshipRoutes.map(path=><Route key={path} path={path} component={LiveRelationshipsPage}/>)}');
    expect(app).toContain('<Route path="/friends/mutual" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/friendship/manage" component={LiveDataUnavailablePage}/>');
    expect(app).not.toContain('<Route path="/blocked/unblock" component={LiveDataUnavailablePage}/>');
    expect(liveRelationships).toContain("api.getFriends");
    expect(liveRelationships).toContain("api.getFriendRequests");
    expect(liveRelationships).toContain("api.getOutgoingFriendRequests");
    expect(liveRelationships).toContain("api.getFriendSuggestions");
    expect(liveRelationships).toContain("api.getFollowers");
    expect(liveRelationships).toContain("api.getFollowing");
    expect(liveRelationships).toContain("api.getBlocked");
    expect(liveRelationships).toContain('location === "/blocked/unblock"');
    expect(liveRelationships).toContain('api.unblockUser(userId)');
    expect(liveRelationships).toContain("api.findOrCreateDirectConversation");
    expect(liveRelationships).toContain("api.respondToFriendRequest");
    expect(liveRelationships).toContain("api.cancelOutgoingFriendRequest");
    expect(liveRelationships).toContain("api.dismissFriendSuggestion");
    expect(liveRelationships).not.toContain("const suggestedUsers");
    expect(liveRelationships).not.toContain("عمر الحضرمي");
    expect(appShell).toContain('"/people/discover"');
    expect(appShell).toContain('"/friend-requests/sent"');
  });

  it("protects the personal media creation route and does not leave it usable for guests", () => {
    expect(appShell).toContain('const isGuestMediaCreatePage = location === "/create/media" && !isCurrentUserLoading && !currentUser;');
    expect(appShell).toContain("سجّل الدخول لرفع الوسائط");
    expect(referenceSuite).toContain('path === "/albums" && <Link href="/create/media"');
    expect(referenceSuiteStyles).toContain('.app-shell--guest .collection-page .collection-intro a[href="/create/media"]{display:none}');
  });

  it("publishes only the REST-backed profile editor and keeps unsupported media editing flows unavailable", () => {
    expect(app).toContain('import { LiveProfileEditPage } from "./pages/LiveProfileEditPage";');
    expect(app).toContain('<Route path="/profile/edit" component={LiveProfileEditPage}/>');
    expect(app).toContain('<Route path="/create/media" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/media/editor" component={LiveDataUnavailablePage}/>');
    expect(app).toContain('<Route path="/create/video" component={LiveDataUnavailablePage}/>');
    expect(app).not.toContain('component={EditProfilePage}');
    expect(app).not.toContain('component={CreateMediaPage}');
    expect(app).not.toContain('component={ImageEditorPage}');
    expect(app).not.toContain('component={UploadVideoPage}');
    expect(liveProfileEdit).toContain("api.getMe");
    expect(liveProfileEdit).toContain("api.updateMe");
    expect(liveProfileEdit).toContain("api.uploadMedia");
    expect(liveProfileEdit).toContain("setCurrentUser");
    expect(liveProfileEdit).not.toContain("عمر الحضرمي");
    expect(liveDataUnavailable).toContain('"/create/video": "رفع فيديو"');
  });

  it("keeps the published media library REST-backed and excludes stories, Reels, broadcasts, and sample posts", () => {
    expect(app).toContain('<Route path="/media" component={LiveMediaPage}/>');
    expect(liveMedia).toContain("queryFn: () => api.getMedia(kind)");
    expect(liveMedia).toContain("queryFn: api.getMediaAlbums");
    expect(liveMedia).toContain("api.uploadMedia(file)");
    expect(liveMedia).toContain("mutationFn: api.deleteMedia");
    expect(liveMedia).not.toContain(">Reels<");
    expect(liveMedia).not.toContain("بث مباشر");
    expect(liveMedia).not.toContain("PostCard");
    expect(liveMedia).not.toContain("posts[");
  });

  it("does not expose account settings controls to guests", () => {
    expect(appShell).toContain('const isSettingsAuthPending = isSettingsPage && isCurrentUserLoading;');
    expect(appShell).toContain('const isGuestSettingsPage = isSettingsPage && !isCurrentUserLoading && !currentUser;');
    expect(appShell).toContain("لن تظهر إعدادات الحساب قبل التحقق من تسجيل الدخول.");
    expect(appShell).toContain("سجّل الدخول لإدارة الإعدادات");
    expect(appShell).toContain("لتعديل الخصوصية والأمان وتفضيلات الحساب");
  });

  it("hides incomplete account collections instead of presenting fabricated account data", () => {
    expect(app).toContain("profileCollections.map(path=><Route key={path} path={path} component={LiveDataUnavailablePage}/>)");
    expect(app).not.toContain("PrivateProfileCollectionsPage");
    expect(privateProfileCollections).not.toContain("أعجبت بمنشور عن صنعاء القديمة");
    expect(privateProfileCollections).not.toContain("gallery.concat");
  });
});
