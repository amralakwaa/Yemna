import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminAccessGuard } from "./AdminAccessGuard";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderAdminPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminAccessGuard /></QueryClientProvider>);
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

  it("لا يعرض أي بيانات إدارية للمستخدم غير المسجل", () => {
    renderAdminPage();

    expect(screen.getByText("تسجيل الدخول مطلوب")).toBeTruthy();
    expect(screen.getByText(/تتطلب لوحة الإدارة تسجيل الدخول بحساب يحمل صلاحية المدير/)).toBeTruthy();
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

    await waitFor(() => expect(screen.getByText("لا يمكن فتح لوحة الإدارة")).toBeTruthy());
    expect(screen.getByText(/حسابك لا يحمل صلاحية المدير/)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/admin/stats"), expect.any(Object));
    expect(screen.queryByText("بيانات توضيحية")).toBeNull();
  });
});
