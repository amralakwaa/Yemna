import express from "express";
import { JwtService } from "@nestjs/jwt";
import { AppRole } from "@prisma/client";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEVELOPMENT_JWT_ACCESS_SECRET } from "../config/env";
import { bootstrapNestApi } from "../nest";

describe("HTTP authentication and RBAC", () => {
  const expressApp = express();
  const jwt = new JwtService();
  let server: Server;
  let baseUrl: string;
  let nestApp: Awaited<ReturnType<typeof bootstrapNestApi>>;

  beforeAll(async () => {
    nestApp = await bootstrapNestApi(expressApp);
    await new Promise<void>(resolve => {
      server = expressApp.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not allocate HTTP test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await nestApp.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  async function tokenFor(role: AppRole) {
    return jwt.signAsync(
      { sub: `test-${role.toLowerCase()}`, role, sessionId: "session-test" },
      { secret: process.env.YEMNA_JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? DEVELOPMENT_JWT_ACCESS_SECRET, expiresIn: "15m" }
    );
  }

  it("يرفض الطلب غير المزوّد برمز Bearer لمسار المستخدم المحمي", async () => {
    const response = await fetch(`${baseUrl}/api/v1/users/me`);
    expect(response.status).toBe(401);
  });

  it("يرفض رمز المستخدم العادي لمسار الإدارة", async () => {
    const response = await fetch(`${baseUrl}/api/v1/admin/stats`, { headers: { Authorization: `Bearer ${await tokenFor(AppRole.USER)}` } });
    expect(response.status).toBe(403);
  });

  it("يسمح لرمز المدير بالوصول إلى إحصاءات الإدارة", async () => {
    const response = await fetch(`${baseUrl}/api/v1/admin/stats`, { headers: { Authorization: `Bearer ${await tokenFor(AppRole.ADMIN)}` } });
    expect(response.status).toBe(200);
  });
});
