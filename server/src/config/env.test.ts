import { describe, expect, it } from "vitest";
import { validateEnv } from "./env";

const platformSecret = "platform-jwt-secret-that-is-long-enough-for-production";

describe("validateEnv", () => {
  it("accepts the platform JWT secret as the production access-token secret", () => {
    const config = validateEnv({ NODE_ENV: "production", JWT_SECRET: platformSecret });

    expect(config.JWT_SECRET).toBe(platformSecret);
  });

  it("accepts a non-empty platform JWT secret regardless of its display length", () => {
    expect(validateEnv({ NODE_ENV: "production", JWT_SECRET: "platform-secret" }).JWT_SECRET).toBe("platform-secret");
  });

  it("rejects production when neither supported access-token secret is present", () => {
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow("JWT access secret");
  });
});
