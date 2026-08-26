import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SettingsPage } from "./LiveSettingsPage";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ThemeProvider><CurrentUserProvider><SettingsPage /></CurrentUserProvider></ThemeProvider></QueryClientProvider>);
}

describe("صفحات الإعدادات الحية", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("لا يعرض مفاتيح الخصوصية أو الإشعارات للمستخدم غير المسجل", async () => {
    sessionStorage.clear();
    setPath("/settings/privacy");
    renderSettings();

    await waitFor(() => expect(screen.getByText("سجّل الدخول لإدارة الإعدادات")).toBeTruthy());
    expect(screen.queryByRole("switch", { name: "السماح بالرسائل المباشرة" })).toBeNull();
  });

  it("يحافظ على نفس حالة الضيف الصادقة لمسار الأمان", async () => {
    sessionStorage.clear();
    setPath("/settings/security");
    renderSettings();

    await waitFor(() => expect(screen.getByText("سجّل الدخول لإدارة الإعدادات")).toBeTruthy());
    expect(screen.queryByText("تغيير كلمة المرور")).toBeNull();
  });
});
