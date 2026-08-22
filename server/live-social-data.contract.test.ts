import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const yemnaPages = readFileSync(resolve(import.meta.dirname, "../client/src/pages/YemnaPages.tsx"), "utf8");
const socialSuite = readFileSync(resolve(import.meta.dirname, "../client/src/pages/SocialSuite.tsx"), "utf8");

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
});
