import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { PrismaService, withPrismaPoolSettings } from "./prisma.service";

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

describe("PrismaService connection lifecycle", () => {
  it("يبقي إقلاع التطبيق متاحاً عندما يفشل اتصال PostgreSQL، ولا يدّعي جاهزية البيانات", async () => {
    const connectionError = new Error("database host is unavailable");
    const service = {
      databaseConnected: true,
      hasDatabaseConfiguration: () => true,
      $connect: vi.fn().mockRejectedValue(connectionError),
      logger: { error: vi.fn() },
      isConnected: PrismaService.prototype.isConnected,
    } as unknown as PrismaService;

    await expect(PrismaService.prototype.onModuleInit.call(service)).resolves.toBeUndefined();

    expect(PrismaService.prototype.isConfigured.call(service)).toBe(false);
    expect(service.$connect).toHaveBeenCalledOnce();
    expect(service.logger.error).toHaveBeenCalledWith(expect.stringContaining("database-backed endpoints will return 503"));
  });
});
