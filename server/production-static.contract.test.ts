import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serverEntry = readFileSync(resolve(import.meta.dirname, "_core/index.ts"), "utf8");
const staticServer = readFileSync(resolve(import.meta.dirname, "_core/vite.ts"), "utf8");

describe("production delivery contract", () => {
  it("keeps an unauthenticated health probe outside application data routes", () => {
    expect(serverEntry).toContain('app.get("/healthz"');
    expect(serverEntry).toContain('json({ ok: true, service: "yemna" })');
  });

  it("resolves the built client relative to the deployment working directory and fails fast if absent", () => {
    expect(staticServer).toContain('path.resolve(process.cwd(), "dist", "public")');
    expect(staticServer).toContain('candidates.find(candidate => fs.existsSync(path.resolve(candidate, "index.html")))');
    expect(staticServer).toContain('Could not find the built client index.html');
  });
});
