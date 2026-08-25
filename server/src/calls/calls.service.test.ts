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

  it("لا يكشف TURN إلا عند اكتمال بياناته الصحيحة", () => {
    const values = { YEMNA_TURN_URLS: "turn:relay.example.org:3478, turns:relay.example.org:5349", YEMNA_TURN_USERNAME: "temporary-user", YEMNA_TURN_CREDENTIAL: "temporary-credential" };
    const service = new CallsService({ get: vi.fn((key: keyof typeof values) => values[key]) } as never);

    expect(service.iceConfig()).toEqual({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        { urls: ["turn:relay.example.org:3478", "turns:relay.example.org:5349"], username: "temporary-user", credential: "temporary-credential" },
      ],
      turnConfigured: true,
    });
  });
});
