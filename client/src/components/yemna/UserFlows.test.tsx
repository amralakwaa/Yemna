// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { LoginPage } from "@/pages/YemnaPages";
import { LiveSearchPage } from "@/pages/LiveSearchPage";
import { AccountSuitePage } from "@/pages/CompletionSuite";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
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
    render(<AppShell title="اختبار التدفق"><p>محتوى اختبار</p></AppShell>);

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
