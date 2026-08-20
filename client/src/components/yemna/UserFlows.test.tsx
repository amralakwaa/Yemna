// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { CreatePage, HomePage, LoginPage } from "@/pages/YemnaPages";
import { LiveSearchPage } from "@/pages/LiveSearchPage";
import { AccountSuitePage, RelationsCompletionPage } from "@/pages/CompletionSuite";
import { CreatePostDetailPage, PostDetailPage, ProfileCollectionPage } from "@/pages/ReferenceSuite";
import { CurrentUserProvider, useCurrentUser } from "@/contexts/CurrentUserContext";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CurrentUserProvider>{ui}</CurrentUserProvider></QueryClientProvider>);
}

function CurrentUserRefreshControl() {
  const { refreshUser } = useCurrentUser();
  return <button type="button" onClick={() => { void refreshUser(); }}>تحديث بيانات الحساب</button>;
}

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

describe("تدفقات المستخدم الأساسية", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPath("/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ينتقل بالتنقل المشترك من العلاقات إلى الإشعارات ويفتح قائمة الهاتف إلى البحث", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AppShell title="اختبار التدفق"><p>محتوى اختبار</p></AppShell>);

    await user.click(screen.getAllByRole("link", { name: "الأصدقاء" })[0]);
    expect(window.location.pathname).toBe("/friends");

    await user.click(screen.getAllByRole("link", { name: /الإشعارات/ })[0]);
    expect(window.location.pathname).toBe("/notifications");

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    const drawer = screen.getByRole("dialog", { name: "القائمة الرئيسية" });
    await user.click(within(drawer).getByRole("link", { name: "استكشاف" }));
    expect(window.location.pathname).toBe("/search");
    expect(screen.queryByRole("dialog", { name: "القائمة الرئيسية" })).toBeNull();
  });

  it("يعرض بيانات الحساب الحية في الغلاف ويحدّث الاسم والصورة بعد إعادة الجلب", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const originalUser = { id: "user-1", displayName: "ريم صنعاء", username: "reem-sanaa", avatarUrl: "https://example.test/reem-before.jpg" };
    const updatedUser = { ...originalUser, displayName: "ريم اليمن", avatarUrl: "https://example.test/reem-after.jpg" };
    let userReadCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(userReadCount++ === 0 ? originalUser : updatedUser);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse({ items: [], nextCursor: null });
    }));
    const user = userEvent.setup();
    renderWithQuery(<><CurrentUserRefreshControl/><AppShell title="اختبار الحساب"><p>محتوى اختبار</p></AppShell></>);

    expect(await screen.findByText("ريم صنعاء")).toBeTruthy();
    expect(screen.queryByText("عمر الحضرمي")).toBeNull();
    expect(screen.getByAltText("ريم صنعاء").getAttribute("src")).toBe(originalUser.avatarUrl);

    await user.click(screen.getAllByRole("button", { name: "فتح القائمة" })[0]);
    expect(within(screen.getByRole("dialog", { name: "القائمة الرئيسية" })).getByText("ريم صنعاء")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تحديث بيانات الحساب" }));

    await waitFor(() => expect(screen.getAllByText("ريم اليمن")).toHaveLength(2));
    expect(screen.getAllByAltText("ريم اليمن").every(image => image.getAttribute("src") === updatedUser.avatarUrl)).toBe(true);
  });

  it("يعرض الحساب الحي في العلاقات وواجهة إنشاء محتوى الوسائط بدلاً من الاسم التجريبي", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-7", displayName: "سلمى تعز", username: "salma-taiz", avatarUrl: "https://example.test/salma.jpg" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(liveUser)));

    setPath("/friends/mutual");
    const relations = renderWithQuery(<RelationsCompletionPage />);
    expect((await screen.findAllByAltText("سلمى تعز")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByAltText("عمر الحضرمي")).toBeNull();
    relations.unmount();

    setPath("/create/post");
    renderWithQuery(<CreatePostDetailPage />);
    expect((await screen.findAllByText("سلمى تعز")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByAltText("سلمى تعز").every(image => image.getAttribute("src") === liveUser.avatarUrl)).toBe(true);
    expect(screen.queryByText("عمر بلال الأكوع")).toBeNull();
  });

  it("يعيد تسجيل الدخول الناجح المستخدم إلى التغذية ويخزن رمز الوصول في جلسة المتصفح", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      accessToken: "test-access-token",
      user: { id: "user-1", displayName: "مستخدم الاختبار", username: "tester" },
    })));
    setPath("/login");
    const user = userEvent.setup();
    renderWithQuery(<LoginPage />);

    await user.type(screen.getByPlaceholderText("example@yemna.ye"), "tester@yemna.ye");
    await user.type(screen.getByPlaceholderText("••••••••"), "password-for-test");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(sessionStorage.getItem("yemna_access_token")).toBe("test-access-token");
  });

  it("يعرض نتائج البحث الحي ويوصلها إلى الملف العام وإلى استكشاف المجتمع", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      users: [{ id: "user-2", displayName: "أمل صنعاء", username: "amal-sanaa", city: "صنعاء" }],
      posts: [],
      communities: [{ id: "community-1", name: "مجتمع صنعاء", slug: "sanaa", description: "مجتمع محلي", _count: { members: 10 } }],
    })));
    const user = userEvent.setup();
    renderWithQuery(<LiveSearchPage />);

    await user.type(screen.getByPlaceholderText("ابحث في يمنا"), "صنعاء");
    const profileLink = await screen.findByRole("link", { name: "عرض الملف" });
    await user.click(profileLink);
    expect(window.location.pathname).toBe("/profile/amal-sanaa");

    setPath("/search");
    const communityLink = screen.getAllByRole("link", { name: "استكشاف" }).find(link => link.getAttribute("href")?.startsWith("/communities?"));
    expect(communityLink).toBeDefined();
    await user.click(communityLink!);
    expect(window.location.pathname).toBe("/communities");
    expect(window.location.search).toBe("?community=sanaa");
  });

  it("يعرض زر تعديل الملف الشخصي في الحساب الحالي وينقل إلى نموذج التعديل", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      id: "user-1", email: "tester@yemna.ye", username: "tester", displayName: "مستخدم الاختبار", bio: "نبذة مختصرة", status: "ACTIVE",
    })));
    setPath("/account/info");
    const user = userEvent.setup();
    renderWithQuery(<AccountSuitePage />);

    const editLink = await screen.findByRole("link", { name: "تعديل الملف الشخصي" });
    expect(editLink.getAttribute("href")).toBe("/account/edit");
    await user.click(editLink);
    expect(window.location.pathname).toBe("/account/edit");
  });

  it("ينشئ منشوراً عبر REST ثم ينتقل إلى معرف المنشور الذي أعاده الخادم", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-9", displayName: "هدى إب", username: "huda-ibb", avatarUrl: "https://example.test/huda.jpg" };
    const createdPost = { id: "post-22", body: "يوم جميل في إب", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts") && init?.method === "POST") return jsonResponse(createdPost);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    setPath("/create/post");
    const user = userEvent.setup();
    renderWithQuery(<CreatePostDetailPage />);

    await user.type(await screen.findByPlaceholderText("بم تفكر اليوم يا هدى إب؟"), createdPost.body);
    await user.click(screen.getByRole("button", { name: "نشر" }));

    await waitFor(() => expect(window.location.pathname).toBe("/post/post-22"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: createdPost.body, visibility: "PUBLIC", mediaIds: [] }) }));
  });

  it("يفتح زر رفع الفيديو في الصفحة الرئيسية منتقي ملفات الفيديو للمستخدم المسجل", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-home-video", displayName: "ماجد صنعاء", username: "majed-sanaa", avatarUrl: "https://example.test/majed.jpg" };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/stories")) return jsonResponse([]);
      if (url.endsWith("/notifications") || url.endsWith("/messages/conversations")) return jsonResponse([]);
      return jsonResponse({ items: [], nextCursor: null });
    }));
    const user = userEvent.setup();
    renderWithQuery(<HomePage />);

    await screen.findByPlaceholderText("بم تفكر اليوم يا ماجد صنعاء؟");
    const videoButton = await screen.findByRole("button", { name: "رفع فيديو" });
    expect((videoButton as HTMLButtonElement).disabled).toBe(false);
    const fileInput = screen.getByLabelText("إرفاق صورة أو فيديو") as HTMLInputElement;
    const openPicker = vi.spyOn(fileInput, "click");
    await user.click(videoButton);

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(fileInput.accept).toBe("video/*");
  });

  it("يرفع مرفق الصورة قبل إنشاء المنشور ويربط معرفه بالمنشور", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-12", displayName: "راشد مأرب", username: "rashid-marib", avatarUrl: "https://example.test/rashid.jpg" };
    const createdPost = { id: "post-media-1", body: "صورة من مأرب", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts") && init?.method === "POST") return jsonResponse(createdPost);
      if (url.endsWith("/media/upload") && init?.method === "POST") return jsonResponse({ id: "media-1" });
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const uploadedForms: FormData[] = [];
    class CompletedImageUploadRequest {
      status = 0;
      responseText = "";
      withCredentials = false;
      upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() { /* لا يلزم اتصال حقيقي في الاختبار */ }
      setRequestHeader() { /* الترويسة مغطاة في اختبار عميل REST */ }
      send(body: FormData) {
        uploadedForms.push(body);
        this.status = 201;
        this.responseText = JSON.stringify({ id: "media-1" });
        this.onload?.();
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", CompletedImageUploadRequest);
    setPath("/create");
    const user = userEvent.setup();
    renderWithQuery(<CreatePage />);

    await user.type(await screen.findByPlaceholderText("بم تفكر اليوم يا راشد مأرب؟"), createdPost.body);
    const image = new File(["image-body"], "marib.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("إرفاق صورة أو فيديو"), image);
    await user.click(screen.getByRole("button", { name: "نشر" }));

    await waitFor(() => expect(uploadedForms).toHaveLength(1));
    expect(uploadedForms[0]).toBeInstanceOf(FormData);
    expect(uploadedForms[0].get("postId")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: createdPost.body, visibility: "PUBLIC", mediaIds: ["media-1"] }) })));
  });

  it("يرفع فيديو MP4 قبل إنشاء المنشور ويربطه ويعرضه كمشغل في مكتبة الفيديو", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-video", displayName: "أروى صنعاء", username: "arwa-sanaa", avatarUrl: "https://example.test/arwa.jpg" };
    const createdPost = { id: "post-video-1", body: "فيديو من صنعاء", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const videoMedia = [{ id: "media-video-1", kind: "VIDEO", publicUrl: "https://example.test/sanaa.mp4", mimeType: "video/mp4", byteSize: 2048, createdAt: new Date().toISOString() }];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts") && init?.method === "POST") return jsonResponse(createdPost);
      if (url.endsWith("/media/upload") && init?.method === "POST") return jsonResponse(videoMedia[0]);
      if (url.endsWith("/media?kind=VIDEO")) return jsonResponse(videoMedia);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:video-preview"), revokeObjectURL: vi.fn() });
    const uploadedForms: FormData[] = [];
    class CompletedUploadRequest {
      status = 0;
      responseText = "";
      withCredentials = false;
      upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() { /* لا يلزم اتصال حقيقي في الاختبار */ }
      setRequestHeader() { /* تتحقق اختبارات api من الترويسة تفصيلياً */ }
      send(body: FormData) {
        uploadedForms.push(body);
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as unknown as ProgressEvent<EventTarget>);
        this.status = 201;
        this.responseText = JSON.stringify(videoMedia[0]);
        this.onload?.();
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", CompletedUploadRequest);
    const user = userEvent.setup();

    setPath("/create");
    const create = renderWithQuery(<CreatePage />);
    await user.type(await screen.findByPlaceholderText("بم تفكر اليوم يا أروى صنعاء؟"), createdPost.body);
    const video = new File(["video-body"], "sanaa.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText("إرفاق صورة أو فيديو"), video);
    expect(screen.getByText("sanaa.mp4")).toBeTruthy();
    expect(create.container.querySelector("video.composer-video-preview")?.getAttribute("src")).toBe("blob:video-preview");
    await user.click(screen.getByRole("button", { name: "نشر" }));

    await waitFor(() => expect(uploadedForms).toHaveLength(1));
    const body = uploadedForms[0];
    expect((body.get("file") as File).type).toBe("video/mp4");
    expect(body.get("postId")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: createdPost.body, visibility: "PUBLIC", mediaIds: [videoMedia[0].id] }) })));
    create.unmount();

    setPath("/videos");
    renderWithQuery(<ProfileCollectionPage />);
    const player = await screen.findByLabelText("فيديو من حسابك");
    expect(player.tagName).toBe("VIDEO");
    expect(player.getAttribute("src")).toBe(videoMedia[0].publicUrl);
  });

  it("يعرض عدّادات الرسائل والإشعارات من REST بدلاً من الشارات الثابتة", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-13", displayName: "إيمان حضرموت", username: "iman-hadramout" };
    const unreadAt = new Date().toISOString();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/notifications")) return jsonResponse([{ id: "notice-1", readAt: null }, { id: "notice-2", readAt: unreadAt }]);
      if (url.endsWith("/messages/conversations")) return jsonResponse([{ id: "conversation-1", lastReadAt: null, messages: [{ id: "message-1", createdAt: unreadAt, sender: { id: "user-14" } }] }]);
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<AppShell title="اختبار العدّادات"><p>محتوى اختبار</p></AppShell>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/notifications", expect.anything()));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/messages/conversations", expect.anything());
    expect(screen.queryByText("3")).toBeNull();
    await waitFor(() => expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2));
  });

  it("ينشر تعليقاً عبر REST ويعرض وسائط الحساب الحقيقية ويُنهي الجلسة من القائمة", async () => {
    sessionStorage.setItem("yemna_access_token", "test-access-token");
    const liveUser = { id: "user-10", displayName: "ليان عدن", username: "layan-aden", avatarUrl: "https://example.test/layan.jpg" };
    const post = { id: "post-99", body: "تجربة منشور حقيقي", createdAt: new Date().toISOString(), author: liveUser, _count: { comments: 0, reactions: 0, shares: 0 } };
    const media = [{ id: "media-1", kind: "IMAGE", publicUrl: "https://example.test/yemna-photo.jpg", mimeType: "image/jpeg", byteSize: 1200, createdAt: new Date().toISOString() }];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(liveUser);
      if (url.endsWith("/posts/post-99/comments") && init?.method === "POST") return jsonResponse({ id: "comment-1", body: "تعليق حقيقي", createdAt: new Date().toISOString(), author: liveUser });
      if (url.endsWith("/posts/post-99/comments")) return jsonResponse([]);
      if (url.endsWith("/posts/post-99")) return jsonResponse(post);
      if (url.endsWith("/media?kind=IMAGE")) return jsonResponse(media);
      if (url.endsWith("/auth/logout")) return { ok: true, status: 204, json: async () => ({}) } as Response;
      return jsonResponse({ items: [], nextCursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    setPath("/post/post-99");
    const detail = renderWithQuery(<PostDetailPage />);
    await user.type(await screen.findByPlaceholderText("اكتب تعليقاً..."), "تعليق حقيقي");
    await user.click(screen.getByRole("button", { name: "نشر التعليق" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts/post-99/comments", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "تعليق حقيقي" }) })));
    detail.unmount();

    setPath("/photos");
    const collection = renderWithQuery(<ProfileCollectionPage />);
    expect((await screen.findByAltText("وسائط من حسابك")).getAttribute("src")).toBe(media[0].publicUrl);
    collection.unmount();

    setPath("/");
    renderWithQuery(<AppShell title="اختبار الخروج"><p>محتوى اختبار</p></AppShell>);
    await user.click(await screen.findByRole("button", { name: "تسجيل الخروج" }));
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(sessionStorage.getItem("yemna_access_token")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
