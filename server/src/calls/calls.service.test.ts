import { describe, expect, it, vi } from "vitest";
import { CallsService } from "./calls.service";

describe("CallsService", () => {
  it("يعيد STUN عاماً عندما لا تكون خدمة TURN مهيأة", () => {
    const service = new CallsService({ get: vi.fn(() => undefined) } as never);

    expect(service.iceConfig()).toEqual({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      turnConfigured: false,
    });
  });

  it("يقرأ أسرار TURN المهيأة للمشروع ضمن عقد ICE من دون كشفها للمستخدم", () => {
    const values = { WEBRTC_TURN_URL: "turn:relay.example.org:3478, turns:relay.example.org:5349", WEBRTC_TURN_USERNAME: "temporary-user", WEBRTC_TURN_CREDENTIAL: "temporary-credential" };
    const service = new CallsService({ get: vi.fn((key: keyof typeof values) => values[key]) } as never);

    expect(service.iceConfig()).toEqual({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        { urls: ["turn:relay.example.org:3478", "turns:relay.example.org:5349"], username: "temporary-user", credential: "temporary-credential" },
      ],
      turnConfigured: true,
    });
  });

  it("يقبل عناوين TURN المنسوخة بصيغة JSON وبيانات اعتماد محاطة بعلامات اقتباس", () => {
    const values = { WEBRTC_TURN_URL: '["turn:relay.example.org:3478?transport=udp", "turns:relay.example.org:5349"]', WEBRTC_TURN_USERNAME: '"temporary-user"', WEBRTC_TURN_CREDENTIAL: '"temporary-credential"' };
    const service = new CallsService({ get: vi.fn((key: keyof typeof values) => values[key]) } as never);

    expect(service.iceConfig()).toEqual({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        { urls: ["turn:relay.example.org:3478?transport=udp", "turns:relay.example.org:5349"], username: "temporary-user", credential: "temporary-credential" },
      ],
      turnConfigured: true,
    });
  });

  it("يحافظ على أسماء إعداد TURN القديمة كمسار توافق احتياطي", () => {
    const values = { YEMNA_TURN_URLS: "turn:relay.example.org:3478", YEMNA_TURN_USERNAME: "legacy-user", YEMNA_TURN_CREDENTIAL: "legacy-credential" };
    const service = new CallsService({ get: vi.fn((key: keyof typeof values) => values[key]) } as never);

    expect(service.iceConfig().turnConfigured).toBe(true);
  });

  it("يوفر حالة TURN من دون إعادة بيانات الاعتماد", () => {
    const values = { WEBRTC_TURN_URL: "turn:relay.example.org:3478", WEBRTC_TURN_USERNAME: "private-user", WEBRTC_TURN_CREDENTIAL: "private-credential" };
    const service = new CallsService({ get: vi.fn((key: keyof typeof values) => values[key]) } as never);

    expect(service.iceStatus()).toEqual({ turnConfigured: true });
  });
});
