import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearRestAccessToken, setRestAccessToken } from "./api";

describe("عقود REST للحساب والدعم", () => {
  const fetchMock = vi.fn();
  let storage = new Map<string, string>();

  beforeEach(() => {
    storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    clearRestAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("يرسل تحديث الملف الشخصي إلى مسار المستخدم المحمي", async () => {
    setRestAccessToken("access-token-for-test");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "u-1", displayName: "عمر", username: "omar" }), { status: 200 }));

    await api.updateMe({ displayName: "عمر", username: "omar", bio: "نبذة مختصرة" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/users/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ displayName: "عمر", username: "omar", bio: "نبذة مختصرة" });
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token-for-test");
  });

  it("ينشئ طلب دعم بالفئة والعنوان والوصف عبر المسار الصحيح", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "ticket-1", category: "TECHNICAL", subject: "مشكلة", body: "تفاصيل كافية للمشكلة", status: "OPEN", createdAt: "2026-08-20T00:00:00.000Z" }), { status: 201 }));

    const ticket = await api.createSupportTicket({ category: "TECHNICAL", subject: "مشكلة", body: "تفاصيل كافية للمشكلة" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/support/tickets");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ category: "TECHNICAL", subject: "مشكلة", body: "تفاصيل كافية للمشكلة" });
    expect(ticket.status).toBe("OPEN");
  });

  it("يلغي حظر المستخدم عبر المسار المحمي الصحيح", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await api.unblockUser("user/with slash");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/relationships/block/user%2Fwith%20slash");
    expect(init.method).toBe("DELETE");
  });

  it("يطلب صور المكتبة وألبومات المستخدم من العقود المحمية الصحيحة", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await api.getMedia("IMAGE");
    await api.getMediaAlbums();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/media?kind=IMAGE");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/media/albums");
  });

  it("يحذف وسيطاً مع ترميز معرّفه في المسار", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await api.deleteMedia("asset/with slash");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/media/asset%2Fwith%20slash");
    expect(init.method).toBe("DELETE");
  });

  it("يرفع الوسيط كـ FormData إلى المسار المحمي دون فرض ترويسة JSON", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "asset-1", kind: "IMAGE", publicUrl: "/manus-storage/asset-1", mimeType: "image/png", byteSize: 4, createdAt: "2026-08-20T00:00:00.000Z" }), { status: 201 }));

    await api.uploadMedia(new File(["data"], "photo.png", { type: "image/png" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/media/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).get("Content-Type")).toBeNull();
  });

  it("يجلب إحصاءات الإدارة عبر العقد المحمي الصحيح", async () => {
    setRestAccessToken("admin-token-for-test");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ users: 12, posts: 20, communities: 3, openTickets: 1, openReports: 2 }), { status: 200 }));

    const stats = await api.getAdminStats();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/admin/stats");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer admin-token-for-test");
    expect(stats.openReports).toBe(2);
  });

  it("يحدّث حالة البلاغ وحساب المستخدم عبر عقود الإدارة المرمزة", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await api.updateAdminReportStatus("report/42", "REVIEWING");
    await api.updateAdminUserStatus("user/42", "DISABLED");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/admin/reports/report%2F42/status");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ status: "REVIEWING" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/admin/users/user%2F42/status");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ status: "DISABLED" });
  });

  it("يجلب تذاكر الإدارة ويحدّث حالتها عبر العقود المحمية", async () => {
    setRestAccessToken("admin-token-for-test");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await api.getAdminTickets();
    await api.updateAdminTicketStatus("ticket/42", "IN_PROGRESS");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/admin/tickets");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer admin-token-for-test");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/admin/tickets/ticket%2F42/status");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ status: "IN_PROGRESS" });
  });
});
