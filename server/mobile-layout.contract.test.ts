import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

describe("mobile subpage layout contract", () => {
  it("keeps every affected subpage within the phone viewport", () => {
    expect(stylesheet).toContain(".page-stage>:is(.communities-page,.notifications-page,.friends-page,.profile-page,.media-page,.settings-page,.messages-page)");
    expect(stylesheet).toContain("inline-size:100%;max-inline-size:100%;min-inline-size:0;overflow-x:clip");
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
});
