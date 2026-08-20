import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";
function makePrisma(configured = true) { return { isConfigured: vi.fn(() => configured), notification: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 1 })) } }; }
describe("NotificationsService", () => {
  const realtime = { emit: vi.fn() };
  it("يرفض عند غياب قاعدة البيانات", async () => { await expect(new NotificationsService(makePrisma(false) as never, realtime as never).list("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException); });
  it("يعلّم إشعار المستخدم فقط كمقروء", async () => { const prisma = makePrisma(); await new NotificationsService(prisma as never, realtime as never).markRead("user-1", "notification-1"); expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "notification-1", recipientId: "user-1" } })); });
});
