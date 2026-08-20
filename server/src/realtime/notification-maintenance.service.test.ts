import { describe, expect, it, vi } from "vitest";
import { NotificationMaintenanceService } from "./notification-maintenance.service";

describe("NotificationMaintenanceService", () => {
  it("يحذف فقط الإشعارات المقروءة الأقدم من فترة الاحتفاظ", async () => {
    const prisma = { isConfigured: vi.fn(() => true), notification: { deleteMany: vi.fn(async () => ({ count: 2 })) } };
    const service = new NotificationMaintenanceService(prisma as never);

    await expect(service.pruneReadNotifications(new Date("2026-08-20T00:00:00.000Z"))).resolves.toBe(2);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { readAt: { not: null, lt: new Date("2026-05-22T00:00:00.000Z") } } });
    service.onModuleDestroy();
  });
});
