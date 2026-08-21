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

  it("يحفظ رمز الجلسة في التخزين الدائم ويمسحه عند تسجيل الخروج الصريح", () => {
    setRestAccessToken("persistent-session-token");

    expect(localStorage.getItem("yemna_access_token")).toBe("persistent-session-token");
    expect(sessionStorage.getItem("yemna_access_token")).toBe("persistent-session-token");

    clearRestAccessToken();

    expect(localStorage.getItem("yemna_access_token")).toBeNull();
    expect(sessionStorage.getItem("yemna_access_token")).toBeNull();
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

  it("يستعيد رمز الوصول من cookie التحديث ثم يعيد طلب الملف الشخصي بعد 401", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "refreshed-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "u-1", displayName: "عمر", username: "omar" }), { status: 200 }));

    const profile = await api.getMe();

    expect(profile.username).toBe("omar");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/v1/users/me", "/api/v1/auth/refresh", "/api/v1/users/me"]);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization")).toBe("Bearer refreshed-access-token");
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

  it("يجلب أرشيف القصص من المسار المحمي المخصص للمالك", async () => {
    setRestAccessToken("story-archive-token");
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await api.getStoryArchive();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/stories/archive");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer story-archive-token");
  });

  it("يرفع الوسيط كـ FormData بتقدم ظاهر وترويسة وصول، ويقبل الإلغاء", async () => {
    setRestAccessToken("media-token-for-test");
    const requests: UploadRequest[] = [];
    class UploadRequest {
      status = 0;
      responseText = "";
      withCredentials = false;
      headers = new Map<string, string>();
      form?: FormData;
      upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      constructor() { requests.push(this); }
      open(method: string, url: string) { expect(method).toBe("POST"); expect(url).toBe("/api/v1/media/upload"); }
      setRequestHeader(name: string, value: string) { this.headers.set(name, value); }
      send(form: FormData) {
        this.form = form;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent<EventTarget>);
        this.status = 201;
        this.responseText = JSON.stringify({ id: "asset-1", kind: "IMAGE", publicUrl: "/manus-storage/asset-1", mimeType: "image/png", byteSize: 4, createdAt: "2026-08-20T00:00:00.000Z" });
        this.onload?.();
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", UploadRequest);
    const progress: number[] = [];

    const uploaded = await api.uploadMedia(new File(["data"], "photo.png", { type: "image/png" }), { postId: "post-1", onProgress: value => progress.push(value) });

    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get("Authorization")).toBe("Bearer media-token-for-test");
    expect(requests[0].form).toBeInstanceOf(FormData);
    expect(requests[0].form?.get("postId")).toBe("post-1");
    expect(progress).toEqual([50, 100]);
    expect(uploaded.id).toBe("asset-1");

    class PendingUploadRequest extends UploadRequest {
      override send(form: FormData) { this.form = form; }
    }
    vi.stubGlobal("XMLHttpRequest", PendingUploadRequest);
    const controller = new AbortController();
    const pending = api.uploadMedia(new File(["video"], "clip.mp4", { type: "video/mp4" }), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
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
