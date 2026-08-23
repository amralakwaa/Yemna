import { describe, expect, it } from "vitest";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports the API as healthy and does not claim a missing database is ready", () => {
    const service = new HealthService({ hasDatabaseConfiguration: () => false, isConfigured: () => false } as never);
    const result = service.status();
    expect(result.status).toBe("ok");
    expect(result.database).toBe("not-configured");
  });

  it("reports an unreachable configured database without declaring it ready", () => {
    const service = new HealthService({ hasDatabaseConfiguration: () => true, isConfigured: () => false } as never);
    expect(service.status().database).toBe("unavailable");
  });
});
