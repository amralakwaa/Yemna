import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const yemnaPages = readFileSync(resolve(import.meta.dirname, "../client/src/pages/YemnaPages.tsx"), "utf8");
const socialSuite = readFileSync(resolve(import.meta.dirname, "../client/src/pages/SocialSuite.tsx"), "utf8");
const liveCommunities = readFileSync(resolve(import.meta.dirname, "../client/src/pages/LiveCommunitiesPage.tsx"), "utf8");
const app = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");

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
    expect(directory).toContain("لا توجد مجموعات مطابقة");
    expect(directory).toContain("تعذر تحميل المجموعات");
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

  it("gates the feed and stories behind a real session and gives guests an honest state", () => {
    const stories = yemnaPages.split("function Stories() {")[1].split("const MAX_VIDEO_BYTES")[0];
    const home = yemnaPages.split("export function HomePage() {")[1].split("export function LoginPage")[0];

    expect(stories).toContain("enabled: isAuthenticated");
    expect(stories).toContain("سجّل الدخول لمشاهدة قصص المجتمع");
    expect(home).toContain("enabled: isAuthenticated");
    expect(home).toContain("سجّل الدخول لمتابعة مجتمع يمنا");
    expect(home).toContain("!isSessionLoading && !isAuthenticated");
  });
});
