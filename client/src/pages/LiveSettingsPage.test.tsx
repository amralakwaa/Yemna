import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PasswordSettingsPage, PrivacySettingsPage, SettingsPage, TwoFactorSettingsPage } from "./LiveSettingsPage";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderSettings(Page = SettingsPage) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ThemeProvider><CurrentUserProvider><Page /></CurrentUserProvider></ThemeProvider></QueryClientProvider>);
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
    renderSettings(PrivacySettingsPage);

    await waitFor(() => expect(screen.getByText("سجّل الدخول لإدارة الإعدادات")).toBeTruthy());
    expect(screen.queryByRole("switch", { name: "السماح بالرسائل المباشرة" })).toBeNull();
  });

  it("يعرض صفحة كلمة المرور المستقلة بحالة ضيف صادقة", async () => {
    sessionStorage.clear();
    setPath("/settings/password");
    renderSettings(PasswordSettingsPage);

    await waitFor(() => expect(screen.getByText("سجّل الدخول لإدارة الإعدادات")).toBeTruthy());
    expect(screen.getAllByRole("heading", { name: "كلمة المرور" }).some(heading => heading.tagName === "H1")).toBe(true);
    expect(screen.queryByText("تغيير كلمة المرور")).toBeNull();
  });

  it("يعرض تبويب التحقق بخطوتين كصفحة مستقلة من دون مفتاح شكلي للضيف", async () => {
    sessionStorage.clear();
    setPath("/settings/two-factor");
    renderSettings(TwoFactorSettingsPage);

    await waitFor(() => expect(screen.getByText("سجّل الدخول لإدارة الإعدادات")).toBeTruthy());
    expect(screen.getAllByRole("heading", { name: "التحقق بخطوتين" }).some(heading => heading.tagName === "H1")).toBe(true);
  });

  it("يعرض لوحة الإعدادات كصفحة مستقلة عن صفحات التحكم الحساسة", async () => {
    sessionStorage.clear();
    setPath("/settings");
    renderSettings();

    await waitFor(() => expect(screen.getByText("سجّل الدخول لإدارة الإعدادات")).toBeTruthy());
    expect(screen.getAllByRole("heading", { name: "الإعدادات" }).some(heading => heading.tagName === "H1")).toBe(true);
    expect(screen.queryByText("تغيير كلمة المرور")).toBeNull();
  });
});
