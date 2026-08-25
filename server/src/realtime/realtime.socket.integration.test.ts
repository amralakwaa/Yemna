import "reflect-metadata";
import express from "express";
import { createServer, type Server } from "node:http";
import { JwtService } from "@nestjs/jwt";
import { AppRole } from "@prisma/client";
import { io, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEVELOPMENT_JWT_ACCESS_SECRET } from "../config/env";
import { bootstrapNestApi } from "../nest";

describe("ربط Socket.IO بالإصغاء الفعلي", () => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const jwt = new JwtService();
  let nestApp: Awaited<ReturnType<typeof bootstrapNestApi>>;
  let baseUrl: string;
  let socket: Socket | undefined;

  beforeAll(async () => {
    nestApp = await bootstrapNestApi(expressApp, "", httpServer);
    await new Promise<void>(resolve => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Could not allocate Socket.IO test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    socket?.disconnect();
    await nestApp.close();
    if (httpServer.listening) {
      await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
    }
  });

  it("يوثق اتصال المستخدم ويرسل realtime:ready عبر namespace /realtime", async () => {
    const token = await jwt.signAsync(
      { sub: "socket-test-user", role: AppRole.USER, sessionId: "socket-test-session" },
      { secret: process.env.YEMNA_JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? DEVELOPMENT_JWT_ACCESS_SECRET, expiresIn: "5m" },
    );
    socket = io(`${baseUrl}/realtime`, { auth: { token }, transports: ["websocket"], reconnection: false, timeout: 5_000 });

    const ready = await new Promise<{ userId: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Socket.IO readiness timeout")), 5_500);
      socket?.once("realtime:ready", event => {
        clearTimeout(timer);
        resolve(event as { userId: string });
      });
      socket?.once("connect_error", error => {
        clearTimeout(timer);
        reject(error);
      });
    });

    expect(ready).toEqual({ userId: "socket-test-user" });
  });

  it("يمرر مقبس العميل إلى معالج دعوة المكالمة ويعيد إقراراً بدلاً من الاستثناء", async () => {
    const receipt = await new Promise<{ success: boolean; reason?: string; recipientCount: number }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Socket.IO call acknowledgement timeout")), 5_000);
      socket?.emit("call:invite", {}, response => {
        clearTimeout(timer);
        resolve(response as { success: boolean; reason?: string; recipientCount: number });
      });
    });

    expect(receipt).toEqual({ success: false, reason: "invalid_request", recipientCount: 0 });
  });
});
