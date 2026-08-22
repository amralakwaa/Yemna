import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");
const appShell = readFileSync(resolve(import.meta.dirname, "../client/src/components/yemna/AppShell.tsx"), "utf8");

describe("mobile subpage layout contract", () => {
  it("keeps every affected subpage within the phone viewport", () => {
    expect(stylesheet).toContain(".page-stage>:is(.communities-page,.notifications-page,.friends-page,.profile-page,.media-page,.settings-page,.messages-page)");
    expect(stylesheet).toContain("inline-size:100%;max-inline-size:100%;min-inline-size:0;overflow-x:clip");
  });

  it("hides the browser scrollbar on the phone without disabling scrolling", () => {
    expect(stylesheet).toContain("html,body,#root,.app-shell{scrollbar-width:none;-ms-overflow-style:none}");
    expect(stylesheet).toContain("html::-webkit-scrollbar,body::-webkit-scrollbar,#root::-webkit-scrollbar,.app-shell::-webkit-scrollbar{display:none}");
  });

  it("collapses the messages view to one safe mobile column", () => {
    expect(stylesheet).toContain("grid-template-columns:minmax(0,1fr)!important");
    expect(stylesheet).toContain(".messages-page>.conversations,.messages-page>.chat-window{position:relative!important;inset:auto!important");
  });

  it("targets the real notifications, communities, and profile class names", () => {
    expect(stylesheet).toContain(".communities-page .community-content{display:block");
    expect(stylesheet).toContain(".notifications-page .notification-row{display:grid");
    expect(stylesheet).toContain(".profile-page .profile-main{display:flex;flex-wrap:wrap");
  });

  it("uses one contextual mobile header instead of duplicating the page title", () => {
    expect(stylesheet).toContain(".mobile-header.mobile-header-page{display:grid");
    expect(stylesheet).toContain(".mobile-page-title,.page-stage .social-topbar{display:none}");
  });

  it("keeps the mobile chrome in the reference visual order", () => {
    expect(stylesheet).toContain(".mobile-header,.mobile-nav{direction:ltr}");
    expect(stylesheet).toContain(".mobile-header .wordmark,.mobile-header .mobile-context-title,.mobile-nav>a,.mobile-nav .menu-trigger{direction:rtl}");
  });

  it("marks the active bottom destination rather than leaving friends and notifications visually inactive", () => {
    expect(appShell).toContain('href="/friends" className={is("/friends") ? "active" : ""} aria-current={is("/friends") ? "page" : undefined}');
    expect(appShell).toContain('href="/notifications" className={is("/notifications") ? "active" : ""} aria-current={is("/notifications") ? "page" : undefined}');
  });

  it("keeps the mobile drawer operable from both menu triggers and closes after a destination is chosen", () => {
    expect(appShell).toContain('const [mobileMenuOpen, setMobileMenuOpen] = useState(false)');
    expect(appShell).toContain('aria-label="فتح القائمة" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}');
    expect(appShell).toContain('className="mobile-menu-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}');
    expect(appShell).toContain('href={item.path} onClick={() => setMobileMenuOpen(false)} className={is(item.path) ? "mobile-menu-link active" : "mobile-menu-link"}');
    expect(appShell).toContain('className="menu-trigger" aria-label="فتح القائمة" onClick={() => setMobileMenuOpen(true)}');
  });

  it("keeps the post composer actions readable rather than hiding their labels", () => {
    expect(stylesheet).toContain(".composer-actions{display:grid;grid-template-columns:minmax(92px,1.3fr)");
    expect(stylesheet).toContain(".composer-actions button,.composer-actions button:not(.button){min-width:0;width:100%;min-height:38px;flex:1;font-size:9px;white-space:nowrap");
  });
});
