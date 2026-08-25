import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";
function makePrisma(configured = true) {
  return {
    isConfigured: vi.fn(() => configured),
    notification: {
      create: vi.fn(async ({ data }: { data: object }) => ({ id: "notification-1", ...data })),
      upsert: vi.fn(async ({ create }: { create: object }) => ({ id: "notification-1", ...create })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 3),
      deleteMany: vi.fn(async () => ({ count: 1 })),
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
  it("يستخدم مفتاح المصدر لمنع تكرار إشعار الحدث نفسه", async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma as never, realtime as never);
    await service.create({ recipientId: "recipient-1", actorId: "author-1", type: "POST_COMMENT" as never, title: "تعليق جديد", sourceKey: "comment:42" });
    expect(prisma.notification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { recipientId_sourceKey: { recipientId: "recipient-1", sourceKey: "comment:42" } },
      update: expect.objectContaining({ readAt: null }),
    }));
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
  it("يعيد عدّاد الإشعارات غير المقروءة للمستخدم فقط", async () => {
    const prisma = makePrisma();
    const result = await new NotificationsService(prisma as never, realtime as never).unreadCount("user-1");
    expect(result).toEqual({ count: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { recipientId: "user-1", readAt: null } });
  });
  it("يفلتر الإشعارات من الخادم حسب النوع عند طلب المركز", async () => {
    const prisma = makePrisma();
    await new NotificationsService(prisma as never, realtime as never).list("user-1", "CALL_INVITE" as never);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: "user-1", type: "CALL_INVITE" } }));
  });
});
