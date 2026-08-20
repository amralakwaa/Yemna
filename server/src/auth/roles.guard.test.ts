import { AppRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { RolesGuard } from "./roles.guard";

function contextFor(role?: AppRole) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { sub: "user-1", role, sessionId: "session-1" } : undefined }) }),
  };
}

describe("RolesGuard", () => {
  it("يسمح بالمسار الذي لا يطلب دوراً محدداً", () => {
    const reflector = { getAllAndOverride: vi.fn(() => undefined) };
    expect(new RolesGuard(reflector as never).canActivate(contextFor() as never)).toBe(true);
  });

  it("يمنع المستخدم العادي من مسار المدير ويسمح للمدير", () => {
    const reflector = { getAllAndOverride: vi.fn(() => [AppRole.ADMIN]) };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(contextFor(AppRole.USER) as never)).toBe(false);
    expect(guard.canActivate(contextFor(AppRole.ADMIN) as never)).toBe(true);
  });
});
