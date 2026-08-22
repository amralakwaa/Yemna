import { describe, expect, it } from "vitest";
import { withPrismaPoolSettings } from "./prisma.service";

describe("withPrismaPoolSettings", () => {
  it("يضيف حدوداً آمنة لتجمع PostgreSQL حين لا تكون مضبوطة", () => {
    const configuredUrl = withPrismaPoolSettings("postgresql://user:password@db.example.test:5432/yemna?sslmode=require");
    const parsed = new URL(configuredUrl);

    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(parsed.searchParams.get("connection_limit")).toBe("3");
    expect(parsed.searchParams.get("pool_timeout")).toBe("30");
  });

  it("يحترم حدود التجمع التي يضبطها مشغل البنية التحتية", () => {
    const configuredUrl = withPrismaPoolSettings("postgresql://user:password@db.example.test:5432/yemna?connection_limit=2&pool_timeout=45");
    const parsed = new URL(configuredUrl);

    expect(parsed.searchParams.get("connection_limit")).toBe("2");
    expect(parsed.searchParams.get("pool_timeout")).toBe("45");
  });

  it("لا يغيّر قيمة اتصال غير صالحة ليبقى التحقق الأصلي واضحاً", () => {
    expect(withPrismaPoolSettings("not-a-postgresql-url")).toBe("not-a-postgresql-url");
  });
});

