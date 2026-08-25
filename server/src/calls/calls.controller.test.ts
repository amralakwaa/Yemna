import { describe, expect, it, vi } from "vitest";
import { CallsController } from "./calls.controller";

describe("CallsController", () => {
  it("يعيد حالة TURN الآمنة فقط", () => {
    const calls = { iceStatus: vi.fn(() => ({ turnConfigured: true })) };
    const controller = new CallsController(calls as never);

    expect(controller.iceStatus()).toEqual({ turnConfigured: true });
    expect(calls.iceStatus).toHaveBeenCalledOnce();
  });
});
