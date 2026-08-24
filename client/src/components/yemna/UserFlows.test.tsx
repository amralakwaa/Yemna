// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "wouter";
import { AppShell } from "./AppShell";
import { CreatePage, HomePage, LoginPage, SettingsPage } from "@/pages/YemnaPages";
import { LiveSearchPage } from "@/pages/LiveSearchPage";
import { LiveRelationshipsPage } from "@/pages/LiveRelationshipsPage";
import { LiveProfileEditPage } from "@/pages/LiveProfileEditPage";
import { LiveSupportPage } from "@/pages/LiveSupportPage";
import { LiveAdminPage } from "@/pages/LiveAdminPage";
import { LiveAssistantPage } from "@/pages/LiveAssistantPage";
import { LiveCommunityDetailPage } from "@/pages/LiveCommunityDetailPage";
import { LiveCommunityCreatePage } from "@/pages/LiveCommunityCreatePage";
import { LiveStoryCreatePage } from "@/pages/LiveStoryCreatePage";
import { RelationsCompletionPage } from "@/pages/CompletionSuite";
import { LiveAccountPage } from "@/pages/LiveAccountPage";
import { RealtimeMessagesPage } from "@/pages/RealtimePages";
import { CreatePostDetailPage, PostDetailPage, ProfileCollectionPage, ProfileDetailPage } from "@/pages/ReferenceSuite";
import { CurrentUserProvider, useCurrentUser } from "@/contexts/CurrentUserContext";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CurrentUserProvider>{ui}</CurrentUserProvider></QueryClientProvider>);
}

function CurrentUserRefreshControl() {
  const { refreshUser } = useCurrentUser();
  return <button type="button" onClick={() => { void refreshUser(); }}>تحديث بيانات الحساب</button>;
}

function CurrentUserName() {
  const { currentUser } = useCurrentUser();
  return <output aria-label="اسم الحساب الحالي">{currentUser?.displayName || "ضيف"}</output>;
}

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

describe("تدفقات المستخدم الأساسية", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setPath("/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ينتقل بالتنقل المشترك من العلاقات إلى الإشعارات ويفتح قائمة الهاتف إلى المجموعات", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AppShell title="اختبار التدفق"><p>محتوى اختبار</p></AppShell>);

    await user.click(screen.getAllByRole("link", { name: "الأصدقاء" })[0]);
    expect(window.location.pathname).toBe("/friends");

    await user.click(screen.getAllByRole("link", { name: /الإشعارات/ })[0]);
    expect(window.location.pathname).toBe("/notifications");

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    const drawer = screen.getByRole("dialog", { name: "القائمة الرئيسية" });
    await user.click(within(drawer).getByRole("link", { name: "المجموعات" }));
    expect(window.location.pathname).toBe("/communities");
    expect(screen.queryByRole("dialog", { name: "القائمة الرئيسية" })).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    const reopenedDrawer = screen.getByRole("dialog", { name: "القائمة الرئيسية" });
    await user.click(within(reopenedDrawer).getByRole("link", { name: "استكشاف" }));
    expect(window.location.pathname).toBe("/explore");
    expect(screen.queryByRole("dialog", { name: "القائمة الرئيسية" })).toBeNull();
  });

  it("يعرض قائمة الأصدقاء من REST ويربط إجراءات العلاقة بالبيانات الحية", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-current", displayName: "حساب حالي", username: "current-account" };
    const friend = { id: "friend-user", displayName: "صديق حي", username: "live-friend", city: "عدن" };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/relationships/friends")) return jsonResponse([{ id: "friendship-1", user: friend }]);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    setPath("/friends");
    renderWithQuery(<LiveRelationshipsPage />);

    expect((await screen.findAllByText("صديق حي")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /صديق حي/ }).getAttribute("href")).toBe("/profile/live-friend");
    expect(screen.getByRole("button", { name: "مراسلة" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/relationships/friends", expect.anything());
  });

  it("يفتح ملفي الشخصي من الجلسة الحالية دون تسجيل خروج أو طلب تسجيل دخول ثانٍ", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-current", displayName: "مستخدم يمنا", username: "yemna-user", bio: "نبذة حقيقية" };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      if (url.endsWith("/media?kind=IMAGE")) return jsonResponse([]);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    setPath("/profile");
    renderWithQuery(<ProfileDetailPage />);

    expect((await screen.findAllByText("مستخدم يمنا")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("نبذة حقيقية").length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe("/profile");
    expect(sessionStorage.getItem("yemna_access_token")).toBe("test-access-token");
    expect(screen.queryByText("سجّل الدخول لعرض ملفك")).toBeNull();
  });

  it("يستعيد الجلسة من ملف الارتباط قبل طلب المستخدم عند إعادة تحميل الملف الشخصي", async () => {
    const liveUser = { id: "user-refresh", displayName: "حساب مستعاد", username: "restored-user", bio: "جلسة مستعادة" };
    const requestOrder: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        requestOrder.push("refresh");
        return jsonResponse({ accessToken: "restored-access-token", user: liveUser });
      }
      if (url.endsWith("/users/me")) {
        requestOrder.push("me");
        return jsonResponse(liveUser);
      }
      return jsonResponse([]);
    }));
    setPath("/profile");
    renderWithQuery(<ProfileDetailPage />);

    expect((await screen.findAllByText("حساب مستعاد")).length).toBeGreaterThan(0);
    expect(requestOrder.slice(0, 2)).toEqual(["refresh", "me"]);
    expect(localStorage.getItem("yemna_access_token")).toBe("restored-access-token");
    expect(screen.queryByText("سجّل الدخول لعرض ملفك")).toBeNull();
  });

  it("يعرض بيانات الحساب الحية في الغلاف ويحدّث الاسم والصورة بعد إعادة الجلب", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const originalUser = { id: "user-1", displayName: "ريم صنعاء", username: "reem-sanaa", avatarUrl: "https://example.test/reem-before.jpg" };
    const updatedUser = { ...originalUser, displayName: "ريم اليمن", avatarUrl: "https://example.test/reem-after.jpg" };
    let userReadCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(userReadCount++ === 0 ? originalUser : updatedUser);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse({ items: [], nextCursor: null });
    }));
    const user = userEvent.setup();
    renderWithQuery(<><CurrentUserRefreshControl/><AppShell title="اختبار الحساب"><p>محتوى اختبار</p></AppShell></>);

    expect((await screen.findAllByText("ريم صنعاء")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("عمر الحضرمي")).toBeNull();
    expect(screen.getAllByAltText("ريم صنعاء")[0].getAttribute("src")).toBe(originalUser.avatarUrl);

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    expect(within(screen.getByRole("dialog", { name: "القائمة الرئيسية" })).getByText("ريم صنعاء")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تحديث بيانات الحساب" }));

    await waitFor(() => expect(screen.getAllByText("ريم اليمن")).toHaveLength(3));
    expect(screen.getAllByAltText("ريم اليمن").every(image => image.getAttribute("src") === updatedUser.avatarUrl)).toBe(true);
  });

  it("يعرض الحساب الحي في العلاقات وواجهة إنشاء محتوى الوسائط بدلاً من الاسم التجريبي", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-7", displayName: "سلمى تعز", username: "salma-taiz", avatarUrl: "https://example.test/salma.jpg" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(liveUser)));

    setPath("/friends/mutual");
    const relations = renderWithQuery(<RelationsCompletionPage />);
    expect((await screen.findAllByAltText("سلمى تعز")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByAltText("عمر الحضرمي")).toBeNull();
    relations.unmount();

    setPath("/create/post");
    renderWithQuery(<CreatePostDetailPage />);
    expect((await screen.findAllByText("سلمى تعز")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByAltText("سلمى تعز").every(image => image.getAttribute("src") === liveUser.avatarUrl)).toBe(true);
    expect(screen.queryByText("عمر بلال الأكوع")).toBeNull();
  });

  it("يعيد تسجيل الدخول الناجح المستخدم إلى التغذية ويخزن رمز الوصول في جلسة المتصفح", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      accessToken: "test-access-token",
      user: { id: "user-1", displayName: "مستخدم الاختبار", username: "tester" },
    })));
    setPath("/login");
    const user = userEvent.setup();
    renderWithQuery(<LoginPage />);

    await user.type(screen.getByPlaceholderText("example@yemna.ye"), "tester@yemna.ye");
    await user.type(screen.getByPlaceholderText("••••••••"), "password-for-test");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(sessionStorage.getItem("yemna_access_token")).toBe("test-access-token");
    expect(localStorage.getItem("yemna_access_token")).toBe("test-access-token");
  });

  it("يعرض نتائج البحث الحي ويوصلها إلى تفاصيل الملف والمنشور والمجتمع", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      users: [{ id: "user-2", displayName: "أمل صنعاء", username: "amal-sanaa", city: "صنعاء" }],
      posts: [{ id: "post-search-1", body: "منشور حي من صنعاء", author: { displayName: "أمل صنعاء" }, media: [], _count: { reactions: 2, comments: 1 } }],
      communities: [{ id: "community-1", name: "مجتمع صنعاء", slug: "sanaa", description: "مجتمع محلي", _count: { members: 10 } }],
    })));
    const user = userEvent.setup();
    renderWithQuery(<LiveSearchPage />);

    await user.type(screen.getByPlaceholderText("ابحث في يمنا"), "صنعاء");
    const profileLink = await screen.findByRole("link", { name: "عرض الملف" });
    await user.click(profileLink);
    expect(window.location.pathname).toBe("/profile/amal-sanaa");

    setPath("/search");
    const postLink = screen.getByRole("link", { name: "فتح المنشور post-search-1" });
    expect(postLink.getAttribute("href")).toBe("/post/post-search-1");
    await user.click(postLink);
    expect(window.location.pathname).toBe("/post/post-search-1");

    setPath("/search");
    const communityLink = screen.getByRole("link", { name: "فتح المجتمع مجتمع صنعاء" });
    expect(communityLink.getAttribute("href")).toBe("/community/community-1");
    await user.click(communityLink);
    expect(window.location.pathname).toBe("/community/community-1");
  });

  it("ينشئ مجتمعاً بعقد REST ثم ينتقل فقط إلى معرّف المجتمع الذي أعاده الخادم", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const currentUser = { id: "owner-1", displayName: "منشئ المجتمع", username: "community-owner" };
    const created = { id: "community-created-1", name: "قراءة يمنية", slug: "yemen-reading", visibility: "PUBLIC", _count: { members: 1, posts: 0 } };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse({ accessToken: "restored-token", user: currentUser });
      if (url.endsWith("/users/me")) return jsonResponse(currentUser);
      if (url.endsWith("/communities") && init?.method === "POST") return jsonResponse(created);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    setPath("/communities/create");
    const user = userEvent.setup();
    renderWithQuery(<LiveCommunityCreatePage />);

    await user.type(await screen.findByLabelText(/اسم المجتمع/), "قراءة يمنية");
    await user.type(screen.getByLabelText(/الرابط القصير/), "yemen-reading");
    await user.type(screen.getByLabelText("وصف مختصر اختياري"), "مساحة لقراءة الكتب ومناقشتها.");
    await user.click(screen.getByRole("button", { name: "إنشاء المجتمع" }));

    await waitFor(() => expect(window.location.pathname).toBe("/community/community-created-1"));
    const request = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/communities") && (init as RequestInit | undefined)?.method === "POST");
    expect(request).toBeTruthy();
    expect(JSON.parse(String((request?.[1] as RequestInit).body))).toMatchObject({ name: "قراءة يمنية", slug: "yemen-reading", visibility: "PUBLIC" });
  });

  it("يعرض زر تعديل الملف الشخصي في الحساب الحالي وينقل إلى نموذج التعديل", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      id: "user-1", email: "tester@yemna.ye", username: "tester", displayName: "مستخدم الاختبار", bio: "نبذة مختصرة", status: "ACTIVE",
    })));
    setPath("/account/info");
    const user = userEvent.setup();
    renderWithQuery(<LiveAccountPage />);

    const editLink = await screen.findByRole("link", { name: "تعديل الملف الشخصي" });
    expect(editLink.getAttribute("href")).toBe("/account/edit");
    await user.click(editLink);
    expect(window.location.pathname).toBe("/account/edit");
  });

  it("يحفظ محرر الملف الشخصي عبر REST ويحدّث بيانات الحساب الحية", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const originalUser = { id: "profile-editor", username: "profile_editor", displayName: "ليان صنعاء", bio: "نبذة أولى", avatarUrl: null };
    const savedUser = { ...originalUser, displayName: "ليان اليمن", bio: "نبذة محدثة" };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me") && init?.method === "PATCH") return jsonResponse(savedUser);
      if (url.endsWith("/users/me")) return jsonResponse(originalUser);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/profile/edit");
    renderWithQuery(<><LiveProfileEditPage /><CurrentUserName /></>);

    const name = await screen.findByLabelText("الاسم الظاهر");
    expect(screen.getByRole("status", { name: "اسم الحساب الحالي" }).textContent).toContain("ليان صنعاء");
    await user.clear(name);
    await user.type(name, "ليان اليمن");
    await user.click(screen.getByRole("button", { name: "حفظ التغييرات" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/users/me", expect.objectContaining({ method: "PATCH" })));
    const update = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/users/me") && (init as RequestInit | undefined)?.method === "PATCH");
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toMatchObject({ displayName: "ليان اليمن", bio: "نبذة أولى" });
    await waitFor(() => expect(screen.getByRole("status", { name: "اسم الحساب الحالي" }).textContent).toContain("ليان اليمن"));
  });

  it("يرسل طلب دعم عبر REST ثم ينتقل إلى سجل طلبات الحساب", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "support-user", username: "support_user", displayName: "هند صنعاء" };
    const createdTicket = { id: "ticket-1", category: "TECHNICAL", subject: "تعذر تحميل الصفحة", body: "تتوقف صفحة المحتوى عند الفتح منذ الصباح.", status: "OPEN", createdAt: new Date().toISOString() };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/support/tickets") && init?.method === "POST") return jsonResponse(createdTicket);
      if (url.endsWith("/support/tickets")) return jsonResponse([]);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/help/report");
    renderWithQuery(<LiveSupportPage />);

    await user.type(await screen.findByLabelText("عنوان مختصر"), createdTicket.subject);
    await user.type(screen.getByLabelText("وصف المشكلة"), createdTicket.body);
    await user.click(screen.getByRole("button", { name: "إرسال الطلب" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/support/tickets", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/support/tickets") && (init as RequestInit | undefined)?.method === "POST");
    expect(JSON.parse(String((request?.[1] as RequestInit).body))).toMatchObject({ category: "TECHNICAL", subject: createdTicket.subject, body: createdTicket.body });
    await waitFor(() => expect(window.location.pathname).toBe("/help/report/status"));
  });

  it("يرسل رسالة إلى مساعد يمنا عبر REST ويعرض الرد القادم من الخادم", async () => {
    sessionStorage.setItem("yemna_access_token", "assistant-access-token");
    const liveUser = { id: "assistant-user", username: "assistant_user", displayName: "مستخدم المساعد" };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/assistant/chat") && init?.method === "POST") return jsonResponse({ reply: "هذا رد وصل من الخدمة الحية." });
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/ai/assistant");
    renderWithQuery(<LiveAssistantPage />);

    const composer = await screen.findByPlaceholderText("اكتب رسالتك إلى مساعد يمنا…");
    await user.type(composer, "كيف أكتب منشوراً واضحاً؟");
    await user.click(screen.getByRole("button", { name: "إرسال الرسالة" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/assistant/chat", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/assistant/chat") && (init as RequestInit | undefined)?.method === "POST");
    expect(JSON.parse(String((request?.[1] as RequestInit).body))).toEqual({ message: "كيف أكتب منشوراً واضحاً؟" });
    expect(await screen.findByText("هذا رد وصل من الخدمة الحية.")).toBeTruthy();
  });

  it("يحمل لوحة الإدارة من REST ويحدّث حالة مستخدم عبر عقد الخادم", async () => {
    sessionStorage.setItem("yemna_access_token", "admin-access-token");
    const administrator = { id: "admin-current", displayName: "مدير يمنا", username: "yemna-admin" };
    const managedUser = { id: "account-22", displayName: "مدير حي", username: "live-manager", email: "manager@yemna.ye", status: "ACTIVE" };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(administrator);
      if (url.endsWith("/admin/stats")) return jsonResponse({ users: 4, posts: 8, communities: 2, openTickets: 1, openReports: 0 });
      if (url.endsWith("/admin/users") && init?.method === "PATCH") return jsonResponse({ success: true });
      if (url.endsWith("/admin/users")) return jsonResponse([managedUser]);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/admin/users");
    renderWithQuery(<LiveAdminPage />);

    expect((await screen.findAllByText("مدير حي")).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("حالة مدير حي"), "DISABLED");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/users/account-22/status", expect.objectContaining({ method: "PATCH" })));
    const update = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/admin/users/account-22/status") && (init as RequestInit | undefined)?.method === "PATCH");
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toEqual({ status: "DISABLED" });
  });

  it("يعرض فشل تحميل مستخدمي الإدارة كخطأ صريح قابل لإعادة المحاولة لا كقائمة فارغة", async () => {
    sessionStorage.setItem("yemna_access_token", "admin-access-token");
    const administrator = { id: "admin-current", displayName: "مدير يمنا", username: "yemna-admin" };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(administrator);
      if (url.endsWith("/admin/stats")) return jsonResponse({ users: 4, posts: 8, communities: 2, openTickets: 1, openReports: 0 });
      if (url.endsWith("/admin/users")) return { ok: false, status: 503, json: async () => ({ message: "تعذر الاتصال" }) } as Response;
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/admin/users");
    renderWithQuery(<LiveAdminPage />);

    expect((await screen.findByRole("alert")).textContent).toContain("تعذر تحميل المستخدمون");
    expect(screen.queryByText("لا توجد حسابات متاحة في الاستجابة الحالية.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/admin/users"))).toHaveLength(2));
  });

  it("ينشئ منشوراً عبر REST ثم ينتقل إلى معرف المنشور الذي أعاده الخادم", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-9", displayName: "هدى إب", username: "huda-ibb", avatarUrl: "https://example.test/huda.jpg" };
    const createdPost = { id: "post-22", body: "يوم جميل في إب", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts") && init?.method === "POST") return jsonResponse(createdPost);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    setPath("/create/post");
    const user = userEvent.setup();
    renderWithQuery(<CreatePostDetailPage />);

    await user.type(await screen.findByPlaceholderText("بم تفكر اليوم يا هدى إب؟"), createdPost.body);
    await user.click(screen.getByRole("button", { name: "نشر" }));

    await waitFor(() => expect(window.location.pathname).toBe("/post/post-22"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: createdPost.body, visibility: "PUBLIC", mediaIds: [] }) }));
  });

  it("يفتح زر رفع الفيديو في الصفحة الرئيسية منتقي ملفات الفيديو للمستخدم المسجل", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-home-video", displayName: "ماجد صنعاء", username: "majed-sanaa", avatarUrl: "https://example.test/majed.jpg" };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/stories")) return jsonResponse([]);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse({ items: [], nextCursor: null });
    }));
    const user = userEvent.setup();
    renderWithQuery(<HomePage />);

    await screen.findByPlaceholderText("بم تفكر اليوم يا ماجد صنعاء؟");
    const videoButton = await screen.findByRole("button", { name: "رفع فيديو" });
    expect((videoButton as HTMLButtonElement).disabled).toBe(false);
    const fileInput = screen.getByLabelText("إرفاق صورة أو فيديو") as HTMLInputElement;
    const openPicker = vi.spyOn(fileInput, "click");
    await user.click(videoButton);

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(fileInput.accept).toBe("video/*");
  });

  it("يرفع مرفق الصورة قبل إنشاء المنشور ويربط معرفه بالمنشور", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-12", displayName: "راشد مأرب", username: "rashid-marib", avatarUrl: "https://example.test/rashid.jpg" };
    const createdPost = { id: "post-media-1", body: "صورة من مأرب", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts") && init?.method === "POST") return jsonResponse(createdPost);
      if (url.endsWith("/media/upload") && init?.method === "POST") return jsonResponse({ id: "media-1" });
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const uploadedForms: FormData[] = [];
    class CompletedImageUploadRequest {
      status = 0;
      responseText = "";
      withCredentials = false;
      upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() { /* لا يلزم اتصال حقيقي في الاختبار */ }
      setRequestHeader() { /* الترويسة مغطاة في اختبار عميل REST */ }
      send(body: FormData) {
        uploadedForms.push(body);
        this.status = 201;
        this.responseText = JSON.stringify({ id: "media-1" });
        this.onload?.();
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", CompletedImageUploadRequest);
    setPath("/create");
    const user = userEvent.setup();
    renderWithQuery(<CreatePage />);

    await user.type(await screen.findByPlaceholderText("بم تفكر اليوم يا راشد مأرب؟"), createdPost.body);
    const image = new File(["image-body"], "marib.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("إرفاق صورة أو فيديو"), image);
    await user.click(screen.getByRole("button", { name: "نشر" }));

    await waitFor(() => expect(uploadedForms).toHaveLength(1));
    expect(uploadedForms[0]).toBeInstanceOf(FormData);
    expect(uploadedForms[0].get("postId")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: createdPost.body, visibility: "PUBLIC", mediaIds: ["media-1"] }) })));
  });

  it("يرفع فيديو MP4 قبل إنشاء المنشور ويربطه ويعرضه كمشغل في مكتبة الفيديو", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-video", displayName: "أروى صنعاء", username: "arwa-sanaa", avatarUrl: "https://example.test/arwa.jpg" };
    const createdPost = { id: "post-video-1", body: "فيديو من صنعاء", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const videoMedia = [{ id: "media-video-1", kind: "VIDEO", publicUrl: "https://example.test/sanaa.mp4", mimeType: "video/mp4", byteSize: 2048, createdAt: new Date().toISOString() }];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts") && init?.method === "POST") return jsonResponse(createdPost);
      if (url.endsWith("/media/upload") && init?.method === "POST") return jsonResponse(videoMedia[0]);
      if (url.endsWith("/media?kind=VIDEO")) return jsonResponse(videoMedia);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:video-preview"), revokeObjectURL: vi.fn() });
    const uploadedForms: FormData[] = [];
    class CompletedUploadRequest {
      status = 0;
      responseText = "";
      withCredentials = false;
      upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() { /* لا يلزم اتصال حقيقي في الاختبار */ }
      setRequestHeader() { /* تتحقق اختبارات api من الترويسة تفصيلياً */ }
      send(body: FormData) {
        uploadedForms.push(body);
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as unknown as ProgressEvent<EventTarget>);
        this.status = 201;
        this.responseText = JSON.stringify(videoMedia[0]);
        this.onload?.();
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", CompletedUploadRequest);
    const user = userEvent.setup();

    setPath("/create");
    const create = renderWithQuery(<CreatePage />);
    await user.type(await screen.findByPlaceholderText("بم تفكر اليوم يا أروى صنعاء؟"), createdPost.body);
    const video = new File(["video-body"], "sanaa.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText("إرفاق صورة أو فيديو"), video);
    expect(screen.getByText("sanaa.mp4")).toBeTruthy();
    expect(create.container.querySelector("video.composer-video-preview")?.getAttribute("src")).toBe("blob:video-preview");
    await user.click(screen.getByRole("button", { name: "نشر" }));

    await waitFor(() => expect(uploadedForms).toHaveLength(1));
    const body = uploadedForms[0];
    expect((body.get("file") as File).type).toBe("video/mp4");
    expect(body.get("postId")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: createdPost.body, visibility: "PUBLIC", mediaIds: [videoMedia[0].id] }) })));
    create.unmount();

    setPath("/videos");
    renderWithQuery(<ProfileCollectionPage />);
    const player = await screen.findByLabelText("فيديو من حسابك");
    expect(player.tagName).toBe("VIDEO");
    expect(player.getAttribute("src")).toBe(videoMedia[0].publicUrl);
  });

  it("يعرض عدّادات الرسائل والإشعارات من REST بدلاً من الشارات الثابتة", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-13", displayName: "إيمان حضرموت", username: "iman-hadramout" };
    const unreadAt = new Date().toISOString();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/notifications")) return jsonResponse([{ id: "notice-1", readAt: null }, { id: "notice-2", readAt: unreadAt }]);
      if (url.endsWith("/messages/conversations")) return jsonResponse([{ id: "conversation-1", lastReadAt: null, messages: [{ id: "message-1", createdAt: unreadAt, sender: { id: "user-14" } }] }]);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<AppShell title="اختبار العدّادات"><p>محتوى اختبار</p></AppShell>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/notifications", expect.anything()));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/messages/conversations", expect.anything());
    expect(screen.queryByText("3")).toBeNull();
    await waitFor(() => expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2));
  });

  it("يعرض المحادثات الحقيقية ويفلترها ويرسل رسالة جديدة عبر REST", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const me = { id: "user-me", displayName: "سارة صنعاء", username: "sara-sanaa" };
    const conversation = { id: "conversation-live", kind: "DIRECT", title: null, participants: [{ user: me }, { user: { id: "user-other", displayName: "خالد تعز", username: "khaled-taiz" } }], messages: [{ id: "message-old", body: "مرحباً", createdAt: new Date().toISOString(), sender: me, conversationId: "conversation-live" }] };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(me);
      if (url.endsWith("/messages/conversations") && init?.method === "POST") return jsonResponse(conversation);
      if (url.endsWith("/messages/conversations")) return jsonResponse([conversation]);
      if (url.endsWith("/messages/conversations/conversation-live")) return jsonResponse(conversation.messages);
      if (url.endsWith("/messages/conversations/conversation-live/messages")) return jsonResponse({ id: "message-new", body: "رسالة اختبار", createdAt: new Date().toISOString(), sender: me, conversationId: "conversation-live" });
      if (url.endsWith("/messages/conversations/conversation-live/read")) return jsonResponse({ success: true });
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/messages");
    renderWithQuery(<RealtimeMessagesPage />);

    expect(await screen.findByText("سارة صنعاء، خالد تعز")).toBeTruthy();
    await user.type(screen.getByPlaceholderText("بحث في الرسائل"), "لا توجد");
    expect(await screen.findByText("لا توجد محادثات مطابقة.")).toBeTruthy();
    await user.clear(screen.getByPlaceholderText("بحث في الرسائل"));
    await user.type(screen.getByPlaceholderText("اكتب رسالة..."), "رسالة اختبار");
    await user.click(screen.getByRole("button", { name: "إرسال الرسالة" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/messages/conversations/conversation-live/messages", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "رسالة اختبار" }) })));
  });

  it("ينفذ المتابعة ثم يفتح محادثة مباشرة من الملف العام عبر REST", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const me = { id: "user-me", displayName: "سارة صنعاء", username: "sara-sanaa" };
    const target = { id: "user-target", displayName: "خالد تعز", username: "khaled-taiz", bio: "نبذة الحساب" };
    const conversation = { id: "conversation-direct", kind: "DIRECT", participants: [{ user: me }, { user: target }], messages: [] };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(me);
      if (url.endsWith("/users/khaled-taiz")) return jsonResponse(target);
      if (url.endsWith("/relationships/following")) return jsonResponse([]);
      if (url.includes("/posts?")) return jsonResponse({ items: [], nextCursor: null });
      if (url.endsWith("/relationships/follow/user-target") && init?.method === "POST") return jsonResponse({ id: "follow-1" });
      if (url.endsWith("/messages/conversations/direct") && init?.method === "POST") return jsonResponse(conversation);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/profile/khaled-taiz");
    renderWithQuery(<ProfileDetailPage />);

    await user.click(await screen.findByRole("button", { name: "متابعة" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "تتابعه" })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/relationships/follow/user-target", expect.objectContaining({ method: "POST" }));

    await user.click(screen.getByRole("button", { name: "رسالة" }));
    await waitFor(() => expect(window.location.pathname).toBe("/messages"));
    expect(window.location.search).toBe("?conversation=conversation-direct");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/messages/conversations/direct", expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: "user-target" }) }));
  });

  it("ينشر تعليقاً عبر REST ويعرض وسائط الحساب الحقيقية ويُنهي الجلسة من القائمة", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-10", displayName: "ليان عدن", username: "layan-aden", avatarUrl: "https://example.test/layan.jpg" };
    const post = { id: "post-99", body: "تجربة منشور حقيقي", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const media = [{ id: "media-1", kind: "IMAGE", publicUrl: "https://example.test/yemna-photo.jpg", mimeType: "image/jpeg", byteSize: 1200, createdAt: new Date().toISOString() }];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts/post-99/comments") && init?.method === "POST") return jsonResponse({ id: "comment-1", body: "تعليق حقيقي", createdAt: new Date().toISOString(), author: liveUser });
      if (url.endsWith("/posts/post-99/comments")) return jsonResponse([]);
      if (url.endsWith("/posts/post-99")) return jsonResponse(post);
      if (url.endsWith("/media?kind=IMAGE")) return jsonResponse(media);
      if (url.endsWith("/auth/logout")) return { ok: true, status: 204, json: async () => ({}) } as Response;
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    setPath("/post/post-99");
    const detail = renderWithQuery(<PostDetailPage />);
    await user.type(await screen.findByPlaceholderText("اكتب تعليقاً..."), "تعليق حقيقي");
    await user.click(screen.getByRole("button", { name: "نشر التعليق" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts/post-99/comments", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "تعليق حقيقي" }) })));
    detail.unmount();

    setPath("/photos");
    const collection = renderWithQuery(<ProfileCollectionPage />);
    expect((await screen.findByAltText("وسائط من حسابك")).getAttribute("src")).toBe(media[0].publicUrl);
    collection.unmount();

    setPath("/");
    renderWithQuery(<AppShell title="اختبار الخروج"><p>محتوى اختبار</p></AppShell>);
    await user.click(await screen.findByRole("button", { name: "تسجيل الخروج" }));
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(sessionStorage.getItem("yemna_access_token")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/logout", expect.objectContaining({ method: "POST" }));
  });

  it("يحمي إنشاء القصة للضيف بدعوة دخول صادقة قبل اختيار أي ملف", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    }) as Response));
    setPath("/story/create");
    renderWithQuery(<LiveStoryCreatePage />);

    expect(await screen.findByRole("heading", { name: "سجّل الدخول لإنشاء قصة" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "تسجيل الدخول" }).some(link => link.getAttribute("href") === "/login")).toBe(true);
    expect(screen.queryByText("اختيار من الجهاز")).toBeNull();
  });

  it("يفتح مسار الخصوصية المتصل بالإعدادات الحية ويحفظ اختيار المتابعة عبر REST", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = {
      id: "user-settings",
      displayName: "حساب الخصوصية",
      username: "privacy-user",
      settings: { friendRequestPermission: "FRIENDS", followPermission: "EVERYONE" },
    };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/users/me/settings") && init?.method === "PATCH") return jsonResponse(liveUser);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    setPath("/settings/privacy");
    renderWithQuery(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: "الخصوصية" })).toBeTruthy();
    const followSelect = screen.getByLabelText("من يمكنه متابعتك؟");
    await user.selectOptions(followSelect, "NOBODY");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/users/me/settings",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ followPermission: "NOBODY" }) }),
    ));
  });

  it("يعرض تفاصيل المجتمع وأعضاءه الحقيقيين وينفذ الانضمام عبر REST", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const me = { id: "user-current", displayName: "مستخدم حالي", username: "current-user" };
    const community = {
      id: "community-1", name: "مجتمع عدن الحي", description: "مساحة محلية", visibility: "PUBLIC",
      owner: { id: "owner-1", displayName: "مالك المجتمع", username: "community-owner" },
      _count: { members: 2, posts: 3 },
    };
    const members = [
      { id: "membership-1", role: "MEMBER", user: { id: "member-1", displayName: "صديقة حية", username: "live-member", bio: "عضو فعلي" } },
      { id: "membership-2", userId: "owner-without-username", role: "ADMIN", user: { id: "owner-without-username", displayName: "عضو بلا اسم مستخدم", username: null } },
    ];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(me);
      if (url.endsWith("/communities/community-1/members")) return jsonResponse(members);
      if (url.endsWith("/communities/community-1")) return jsonResponse(community);
      if (url.endsWith("/communities/mine")) return jsonResponse([]);
      if (url.endsWith("/communities/community-1/join") && init?.method === "POST") return jsonResponse({ id: "membership-joined" });
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    setPath("/community/community-1");
    const user = userEvent.setup();
    renderWithQuery(<Route path="/community/:id"><LiveCommunityDetailPage /></Route>);

    expect(await screen.findByRole("heading", { name: "مجتمع عدن الحي" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "صديقة حية" }).getAttribute("href")).toBe("/profile/live-member");
    expect(screen.getByRole("link", { name: "عضو بلا اسم مستخدم" }).getAttribute("href")).toBe("/profile/owner-without-username");
    await user.click(screen.getByRole("button", { name: "انضمام" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/communities/community-1/join", expect.objectContaining({ method: "POST" })));
  });
});
