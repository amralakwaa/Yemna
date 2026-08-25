import { describe, expect, it } from "vitest";
import { getMediaPermissionIssue } from "./CallsContext";

describe("حالات أذونات وسائط المكالمة", () => {
  it("تعرّف رفض المتصفح للإذن بوضوح", () => {
    expect(getMediaPermissionIssue(new DOMException("permission denied", "NotAllowedError"))).toBe("blocked");
    expect(getMediaPermissionIssue(new DOMException("insecure", "SecurityError"))).toBe("blocked");
  });

  it("تميّز بين عدم توفر الجهاز وعدم دعم التقاط الوسائط", () => {
    expect(getMediaPermissionIssue(new DOMException("camera missing", "NotFoundError"))).toBe("unavailable");
    const unsupported = new Error("media unavailable");
    unsupported.name = "MediaUnavailableError";
    expect(getMediaPermissionIssue(unsupported)).toBe("unsupported");
  });
});
