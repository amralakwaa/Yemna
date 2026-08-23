import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync(resolve(import.meta.dirname, "_core/index.ts"), "utf8");

describe("production bootstrap contract", () => {
  it("binds the required deployment port to the public container interface", () => {
    const applicationListen = bootstrap.split('server.once("error"')[1];

    expect(bootstrap).toContain('const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);');
    expect(applicationListen).toContain('server.listen(port, "0.0.0.0", () => {');
    expect(applicationListen).not.toContain("server.listen(port, () => {");
  });

  it("does not select an alternate port in production", () => {
    expect(bootstrap).toContain("const port = isDevelopment ? await findAvailablePort(preferredPort) : preferredPort;");
  });
});
