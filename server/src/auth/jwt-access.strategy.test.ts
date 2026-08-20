import { AppRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { JwtAccessStrategy } from "./jwt-access.strategy";

describe("JwtAccessStrategy", () => {
  it("يعيد حمولة Bearer token المتحقق منها إلى حارس JWT دون تعديل", () => {
    const config = { get: vi.fn(() => "test-access-secret") };
    const strategy = new JwtAccessStrategy(config as never);
    const payload = { sub: "user-1", role: AppRole.USER, sessionId: "session-1" };
    expect(strategy.validate(payload)).toEqual(payload);
  });
});
