import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";
function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    notification: {
      create: vi.fn(async ({ data }: { data: object }) => ({ id: "notification-1", ...data })),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}
describe("NotificationsService", () => {
  const realtime = { emit: vi.fn(async () => undefined) };
  it("يرفض عند غياب قاعدة البيانات", async () => { await expect(new NotificationsService(makePrisma(false) as never, realtime as never).list("user-1")).rejects.toBeInstanceOf(ServiceUnavailableException); });
  it("يعلّم إشعار المستخدم فقط كمقروء", async () => { const prisma = makePrisma(); await new NotificationsService(prisma as never, realtime as never).markRead("user-1", "notification-1"); expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "notification-1", recipientId: "user-1" } })); });
  it("ينشئ الإشعار ويبثه للمستلم", async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma as never, realtime as never);
    await service.create({ recipientId: "recipient-1", actorId: "author-1", type: "MESSAGE" as never, title: "رسالة جديدة" });
    expect(realtime.emit).toHaveBeenCalledWith("recipient-1", "notification:new", expect.objectContaining({ id: "notification-1", title: "رسالة جديدة" }));
  });
});
