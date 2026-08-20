import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationMaintenanceService } from "./notification-maintenance.service";

describe("دورة حياة الإشعار", () => {
  it("ينشئ الإشعار ويبثه ثم يرشّحه عامل التنظيف بعد مدة الاحتفاظ", async () => {
    const notification = {
      id: "notification-1",
      recipientId: "recipient-1",
      actorId: "actor-1",
      type: "MESSAGE",
      title: "رسالة جديدة",
      body: "مرحباً",
      linkUrl: "/messages/conversation-1",
      readAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      actor: { id: "actor-1", displayName: "عمر", username: "omar", avatarUrl: null },
    };
    const prisma = {
      isConfigured: vi.fn(() => true),
      notification: {
        create: vi.fn(async () => notification),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const realtime = { emit: vi.fn(async () => undefined) };
    const notifications = new NotificationsService(prisma as never, realtime as never);
    const created = await notifications.create({
      recipientId: "recipient-1",
      actorId: "actor-1",
      type: "MESSAGE" as never,
      title: "رسالة جديدة",
      body: "مرحباً",
      linkUrl: "/messages/conversation-1",
    });

    expect(created).toEqual(notification);
    expect(realtime.emit).toHaveBeenCalledWith("recipient-1", "notification:new", notification);

    const maintenance = new NotificationMaintenanceService(prisma as never);
    const cleaned = await maintenance.pruneReadNotifications(new Date("2026-05-01T00:00:00.000Z"));

    expect(cleaned).toBe(1);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { readAt: { not: null, lt: new Date("2026-01-31T00:00:00.000Z") } },
    });
  });
});
