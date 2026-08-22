import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiClient = readFileSync(resolve(import.meta.dirname, "../client/src/lib/api.ts"), "utf8");
const currentUserProvider = readFileSync(resolve(import.meta.dirname, "../client/src/contexts/CurrentUserContext.tsx"), "utf8");

describe("session restoration contract", () => {
  it("ends refresh restoration when the network does not settle", () => {
    expect(apiClient).toContain("const REFRESH_TIMEOUT_MS = 6_000;");
    expect(apiClient).toContain("const controller = new AbortController();");
    expect(apiClient).toContain("setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)");
    expect(apiClient).toContain("signal: controller.signal");
    expect(apiClient).toContain("clearTimeout(timeoutId);");
  });

  it("keeps the user provider gated on a refresh that now always settles", () => {
    expect(currentUserProvider).toContain("restoreRestAccessToken({ force: true }).finally");
    expect(currentUserProvider).toContain("setSessionReady(true);");
  });
});
