import { describe, expect, it } from "vitest";
import { attachRemoteMedia, getMediaPermissionIssue } from "./CallsContext";

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

  it("يربط المسار البعيد بعنصر صوت ويطلب تشغيله صراحة", async () => {
    const stream = {} as MediaStream;
    const audio = { srcObject: null, muted: true, volume: 0, play: async () => undefined } as unknown as HTMLAudioElement;

    await expect(attachRemoteMedia(stream, [audio])).resolves.toBe(true);
    expect(audio.srcObject).toBe(stream);
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBe(1);
  });

  it("يعرض مسار تفعيل يدوي عندما يمنع المتصفح التشغيل التلقائي", async () => {
    const stream = {} as MediaStream;
    const audio = { srcObject: null, muted: false, volume: 1, play: async () => { throw new Error("autoplay blocked"); } } as unknown as HTMLAudioElement;

    await expect(attachRemoteMedia(stream, [audio])).resolves.toBe(false);
  });
});
