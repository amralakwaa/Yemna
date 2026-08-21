import { describe, expect, it } from "vitest";
import { compressImageForUpload } from "./media";

describe("compressImageForUpload", () => {
  it("لا يغيّر الفيديو أو الملف غير المصور", async () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    await expect(compressImageForUpload(file)).resolves.toBe(file);
  });

  it("لا يعيد إنشاء صورة صغيرة دون الحاجة", async () => {
    const file = new File(["small"], "photo.jpg", { type: "image/jpeg" });
    await expect(compressImageForUpload(file)).resolves.toBe(file);
  });
});
