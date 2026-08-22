import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
const shell = readFileSync(resolve(import.meta.dirname, "../client/src/components/yemna/AppShell.tsx"), "utf8");
const stylesheet = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

describe("theme toggle contract", () => {
  it("enables the theme provider switch and connects the shell to it", () => {
    expect(app).toContain('<ThemeProvider defaultTheme="light" switchable>');
    expect(shell).toContain("const { theme, toggleTheme } = useTheme();");
    expect(shell).toContain("onClick={toggleTheme}");
  });

  it("renders an accessible stateful switch instead of a decorative control", () => {
    expect(shell).toContain('aria-pressed={theme === "dark"}');
    expect(shell).not.toContain("fake-switch");
    expect(stylesheet).toContain("html.dark{");
    expect(stylesheet).toContain(".theme-switch.is-on");
  });
});
