// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { LoginPage } from "@/pages/YemnaPages";
import { LiveSearchPage } from "@/pages/LiveSearchPage";
import { AccountSuitePage, RelationsCompletionPage } from "@/pages/CompletionSuite";
import { CreatePostDetailPage } from "@/pages/ReferenceSuite";
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

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

describe("تدفقات المستخدم الأساسية", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPath("/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ينتقل بالتنقل المشترك من العلاقات إلى الإشعارات ويفتح قائمة الهاتف إلى البحث", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AppShell title="اختبار التدفق"><p>محتوى اختبار</p></AppShell>);

    await user.click(screen.getAllByRole("link", { name: "الأصدقاء" })[0]);
    expect(window.location.pathname).toBe("/friends");

    await user.click(screen.getAllByRole("link", { name: /الإشعارات/ })[0]);
    expect(window.location.pathname).toBe("/notifications");

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    const drawer = screen.getByRole("dialog", { name: "القائمة الرئيسية" });
    await user.click(within(drawer).getByRole("link", { name: "استكشاف" }));
    expect(window.location.pathname).toBe("/search");
    expect(screen.queryByRole("dialog", { name: "القائمة الرئيسية" })).toBeNull();
  });

  it("يعرض بيانات الحساب الحية في الغلاف ويحدّث الاسم والصورة بعد إعادة الجلب", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const originalUser = { id: "user-1", displayName: "ريم صنعاء", username: "reem-sanaa", avatarUrl: "https://example.test/reem-before.jpg" };
    const updatedUser = { ...originalUser, displayName: "ريم اليمن", avatarUrl: "https://example.test/reem-after.jpg" };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(originalUser))
      .mockResolvedValueOnce(jsonResponse(updatedUser)));
    const user = userEvent.setup();
    renderWithQuery(<><CurrentUserRefreshControl/><AppShell title="اختبار الحساب"><p>محتوى اختبار</p></AppShell></>);

    expect(await screen.findByText("ريم صنعاء")).toBeTruthy();
    expect(screen.queryByText("عمر الحضرمي")).toBeNull();
    expect(screen.getByAltText("ريم صنعاء").getAttribute("src")).toBe(originalUser.avatarUrl);

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    expect(within(screen.getByRole("dialog", { name: "القائمة الرئيسية" })).getByText("ريم صنعاء")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تحديث بيانات الحساب" }));

    await waitFor(() => expect(screen.getAllByText("ريم اليمن")).toHaveLength(2));
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
  });

  it("يعرض نتائج البحث الحي ويوصلها إلى الملف العام وإلى استكشاف المجتمع", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      users: [{ id: "user-2", displayName: "أمل صنعاء", username: "amal-sanaa", city: "صنعاء" }],
      posts: [],
      communities: [{ id: "community-1", name: "مجتمع صنعاء", slug: "sanaa", description: "مجتمع محلي", _count: { members: 10 } }],
    })));
    const user = userEvent.setup();
    renderWithQuery(<LiveSearchPage />);

    await user.type(screen.getByPlaceholderText("ابحث في يمنا"), "صنعاء");
    const profileLink = await screen.findByRole("link", { name: "عرض الملف" });
    await user.click(profileLink);
    expect(window.location.pathname).toBe("/profile/amal-sanaa");

    setPath("/search");
    const communityLink = screen.getAllByRole("link", { name: "استكشاف" }).find(link => link.getAttribute("href")?.startsWith("/communities?"));
    expect(communityLink).toBeDefined();
    await user.click(communityLink!);
    expect(window.location.pathname).toBe("/communities");
    expect(window.location.search).toBe("?community=sanaa");
  });

  it("يعرض زر تعديل الملف الشخصي في الحساب الحالي وينقل إلى نموذج التعديل", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      id: "user-1", email: "tester@yemna.ye", username: "tester", displayName: "مستخدم الاختبار", bio: "نبذة مختصرة", status: "ACTIVE",
    })));
    setPath("/account/info");
    const user = userEvent.setup();
    renderWithQuery(<AccountSuitePage />);

    const editLink = await screen.findByRole("link", { name: "تعديل الملف الشخصي" });
    expect(editLink.getAttribute("href")).toBe("/account/edit");
    await user.click(editLink);
    expect(window.location.pathname).toBe("/account/edit");
  });
});
