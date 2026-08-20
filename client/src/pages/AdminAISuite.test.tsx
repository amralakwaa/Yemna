import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminDetailPage } from "./AdminAISuite";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderAdminPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminDetailPage /></QueryClientProvider>);
}

describe("حالات الوصول إلى الإدارة", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPath("/admin/reports");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("لا يعرض بيانات الإدارة الحية للمستخدم غير المسجل", () => {
    renderAdminPage();

    expect(screen.getByText("سجّل الدخول بحساب مدير لعرض بيانات الإدارة الحية.")).toBeTruthy();
    expect(screen.getByText("سجّل الدخول بحساب مدير لمراجعة تذاكر الدعم وحالاتها.")).toBeTruthy();
    expect(screen.queryByText("بيانات توضيحية")).toBeNull();
  });

  it("يعرض حالة منع صريحة للمستخدم المسجل بلا دور مدير", async () => {
    sessionStorage.setItem("yemna_access_token", "user-without-admin-role");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "لا تملك صلاحية الإدارة" }),
    }));

    renderAdminPage();

    await waitFor(() => expect(screen.getAllByText("حسابك لا يحمل صلاحية المدير.").length).toBeGreaterThanOrEqual(2));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/admin/reports"), expect.any(Object));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/admin/tickets"), expect.any(Object));
  });
});
