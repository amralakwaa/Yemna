import type { Person, Post } from "./yemnaData";

const API_BASE = "/api/v1";
const ACCESS_TOKEN_KEY = "yemna_access_token";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export type ApiUser = { id: string; displayName: string; username: string; fullName?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null; bio?: string | null; city?: string | null; governorate?: string | null; createdAt?: string; status?: string | null; settings?: { showOnlineStatus?: boolean; allowDirectMessages?: boolean } | null };
export type ApiMedia = { url?: string | null; publicUrl?: string | null; kind?: string };
export type ApiPost = { id: string; body: string; publishedAt?: string | null; createdAt: string; author: ApiUser; media?: ApiMedia[]; _count: { comments: number; reactions: number; shares: number } };
export type FeedResponse = { items: ApiPost[]; nextCursor: string | null };
export type ApiComment = { id: string; body: string; createdAt: string; author: ApiUser; replies?: ApiComment[] };
export type ApiMessage = { id: string; body: string; createdAt: string; sender: ApiUser; conversationId: string };
export type ApiConversation = { id: string; kind: "DIRECT" | "GROUP"; title?: string | null; participants: Array<{ user: ApiUser }>; messages?: ApiMessage[]; lastReadAt?: string | null };
export type ApiNotification = { id: string; type: string; title: string; body?: string | null; linkUrl?: string | null; createdAt: string; readAt?: string | null; actor?: ApiUser | null };
export type ApiFriend = { id: string; since?: string; user: ApiUser };
export type ApiFriendRequest = { id: string; requester: ApiUser; createdAt?: string };
export type ApiFollow = { id: string; follower?: ApiUser; followed?: ApiUser; createdAt?: string };
export type ApiBlock = { id: string; blocked: ApiUser; createdAt?: string };
export type ApiCommunity = { id: string; name: string; slug: string; description?: string | null; coverUrl?: string | null; visibility?: "PUBLIC" | "PRIVATE"; owner?: ApiUser; _count?: { members?: number; posts?: number } };
export type ApiSearchPost = Omit<ApiPost, "_count"> & { _count: { comments: number; reactions: number } };
export type ApiSearchResponse = { users: ApiUser[]; posts: ApiSearchPost[]; communities: ApiCommunity[] };
export type ApiSupportTicket = { id: string; category: "ACCOUNT" | "TECHNICAL" | "SAFETY" | "OTHER"; subject: string; body: string; status: string; createdAt: string; updatedAt?: string };
export type ApiMediaAsset = { id: string; kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; publicUrl: string; mimeType: string; byteSize: number; width?: number | null; height?: number | null; durationSeconds?: number | null; createdAt: string; albumId?: string | null; postId?: string | null };
export type ApiAlbum = { id: string; title: string; description?: string | null; coverUrl?: string | null; createdAt: string; updatedAt: string; _count: { assets: number } };
export type ApiAdminStats = { users: number; posts: number; communities: number; openTickets: number; openReports: number };
export type ApiAdminUser = ApiUser & { role?: string; status?: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION" | "DELETED" | null; lastLoginAt?: string | null; reason?: never; reporter?: never };
export type ApiAdminTicket = ApiSupportTicket & { user?: Pick<ApiUser, "id" | "displayName" | "username" | "avatarUrl"> | null };
export type ApiAdminReport = { id: string; reason: string; details?: string | null; status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; createdAt: string; reporter?: Pick<ApiUser, "id" | "displayName" | "username" | "avatarUrl"> | null; displayName: never };
type AuthResponse = { accessToken: string; user: ApiUser };

function readAccessToken() { try { return sessionStorage.getItem(ACCESS_TOKEN_KEY); } catch { return null; } }
export function getRestAccessToken() { return readAccessToken(); }
export function hasRestSession() { return Boolean(readAccessToken()); }
function notifyRestSessionChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("yemna-session-change"));
}

export function setRestAccessToken(token: string) {
  try { sessionStorage.setItem(ACCESS_TOKEN_KEY, token); } catch { /* session storage is unavailable */ }
  notifyRestSessionChange();
}
export function clearRestAccessToken() {
  try { sessionStorage.removeItem(ACCESS_TOKEN_KEY); } catch { /* session storage is unavailable */ }
  notifyRestSessionChange();
}

let pendingRefresh: Promise<string | null> | null = null;
export async function restoreRestAccessToken() {
  if (readAccessToken()) return readAccessToken();
  if (!pendingRefresh) pendingRefresh = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async response => {
      if (!response.ok) return null;
      const payload = await response.json().catch(() => ({})) as Partial<AuthResponse>;
      if (!payload.accessToken) return null;
      setRestAccessToken(payload.accessToken);
      return payload.accessToken;
    })
    .catch(() => null)
    .finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retryAfterRefresh = true): Promise<T> {
  const token = readAccessToken();
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join("، ") : payload.message || "تعذر إكمال الطلب";
    if (response.status === 401 && retryAfterRefresh && path !== "/auth/refresh") {
      clearRestAccessToken();
      if (await restoreRestAccessToken()) return apiRequest<T>(path, init, false);
    }
    if (response.status === 401) clearRestAccessToken();
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

export type MediaUploadOptions = {
  postId?: string;
  albumId?: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
};

function cancelledUploadError() {
  const error = new Error("تم إلغاء رفع الملف");
  error.name = "AbortError";
  return error;
}

export function uploadMediaWithProgress(file: File, options: MediaUploadOptions = {}): Promise<ApiMediaAsset> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(cancelledUploadError());
      return;
    }

    const form = new FormData();
    form.append("file", file);
    if (options.postId) form.append("postId", options.postId);
    if (options.albumId) form.append("albumId", options.albumId);

    const request = new XMLHttpRequest();
    const token = readAccessToken();
    const detachAbort = () => options.signal?.removeEventListener("abort", abort);
    const abort = () => request.abort();

    request.open("POST", `${API_BASE}/media/upload`);
    request.withCredentials = true;
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onprogress = event => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      detachAbort();
      const payload = JSON.parse(request.responseText || "{}") as { message?: string | string[] } & ApiMediaAsset;
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(100);
        resolve(payload);
        return;
      }
      const message = Array.isArray(payload.message) ? payload.message.join("، ") : payload.message || "تعذر رفع الملف";
      if (request.status === 401) clearRestAccessToken();
      reject(new ApiError(request.status, message));
    };
    request.onerror = () => {
      detachAbort();
      reject(new ApiError(0, "تعذر الاتصال أثناء رفع الملف"));
    };
    request.onabort = () => {
      detachAbort();
      reject(cancelledUploadError());
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    request.send(form);
  });
}

export const api = {
  register: (payload: { displayName: string; email?: string; phone?: string; password: string }) => apiRequest<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (identifier: string, password: string) => apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }, false),
  getFeed: () => apiRequest<FeedResponse>("/posts?limit=20"),
  getPost: (postId: string) => apiRequest<ApiPost>(`/posts/${encodeURIComponent(postId)}`),
  createPost: (body: string, visibility: "PUBLIC" | "FRIENDS" | "PRIVATE" = "PUBLIC") => apiRequest<ApiPost>("/posts", { method: "POST", body: JSON.stringify({ body, visibility }) }),
  updatePost: (postId: string, payload: { body?: string; visibility?: "PUBLIC" | "FRIENDS" | "PRIVATE" }) => apiRequest<ApiPost>(`/posts/${encodeURIComponent(postId)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePost: (postId: string) => apiRequest<{ success: boolean }>(`/posts/${encodeURIComponent(postId)}`, { method: "DELETE" }),
  getPostComments: (postId: string) => apiRequest<ApiComment[]>(`/posts/${encodeURIComponent(postId)}/comments`),
  createPostComment: (postId: string, body: string) => apiRequest<ApiComment>(`/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  updatePostComment: (postId: string, commentId: string, body: string) => apiRequest<ApiComment>(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  deletePostComment: (postId: string, commentId: string) => apiRequest<{ success: boolean }>(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" }),
  getMe: () => apiRequest<ApiUser>("/users/me"),
  updateMe: (payload: Partial<Pick<ApiUser, "displayName" | "fullName" | "username" | "bio" | "city" | "governorate" | "avatarUrl">>) => apiRequest<ApiUser>("/users/me", { method: "PATCH", body: JSON.stringify(payload) }),
  getUser: (username: string) => apiRequest<ApiUser>(`/users/${encodeURIComponent(username)}`),
  getConversations: () => apiRequest<ApiConversation[]>("/messages/conversations"),
  getConversationMessages: (conversationId: string) => apiRequest<ApiMessage[]>(`/messages/conversations/${encodeURIComponent(conversationId)}`),
  sendMessage: (conversationId: string, body: string) => apiRequest<ApiMessage>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  markConversationRead: (conversationId: string) => apiRequest<{ success: true }>(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: "PATCH" }),
  getNotifications: () => apiRequest<ApiNotification[]>("/notifications"),
  markNotificationRead: (notificationId: string) => apiRequest<ApiNotification>(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH" }),
  getFriends: () => apiRequest<ApiFriend[]>("/relationships/friends"),
  getFriendRequests: () => apiRequest<ApiFriendRequest[]>("/relationships/requests"),
  respondToFriendRequest: (requestId: string, action: "accept" | "decline") => apiRequest<unknown>(`/relationships/requests/${encodeURIComponent(requestId)}/respond`, { method: "POST", body: JSON.stringify({ action }) }),
  getFollowers: () => apiRequest<ApiFollow[]>("/relationships/followers"),
  getFollowing: () => apiRequest<ApiFollow[]>("/relationships/following"),
  getBlocked: () => apiRequest<ApiBlock[]>("/relationships/blocked"),
  blockUser: (userId: string) => apiRequest<ApiBlock>(`/relationships/block/${encodeURIComponent(userId)}`, { method: "POST" }),
  unblockUser: (userId: string) => apiRequest<void>(`/relationships/block/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  followUser: (userId: string) => apiRequest<unknown>(`/relationships/follow/${encodeURIComponent(userId)}`, { method: "POST" }),
  unfollowUser: (userId: string) => apiRequest<void>(`/relationships/follow/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  getCommunities: () => apiRequest<ApiCommunity[]>("/communities"),
  joinCommunity: (communityId: string) => apiRequest<unknown>(`/communities/${encodeURIComponent(communityId)}/join`, { method: "POST" }),
  leaveCommunity: (communityId: string) => apiRequest<void>(`/communities/${encodeURIComponent(communityId)}/leave`, { method: "DELETE" }),
  getSupportTickets: () => apiRequest<ApiSupportTicket[]>("/support/tickets"),
  createSupportTicket: (payload: Pick<ApiSupportTicket, "category" | "subject" | "body">) => apiRequest<ApiSupportTicket>("/support/tickets", { method: "POST", body: JSON.stringify(payload) }),
  getMedia: (kind?: ApiMediaAsset["kind"]) => apiRequest<ApiMediaAsset[]>(`/media${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`),
  getMediaAlbums: () => apiRequest<ApiAlbum[]>("/media/albums"),
  createMediaAlbum: (payload: Pick<ApiAlbum, "title" | "description" | "coverUrl">) => apiRequest<ApiAlbum>("/media/albums", { method: "POST", body: JSON.stringify(payload) }),
  uploadMedia: (file: File, options?: MediaUploadOptions) => uploadMediaWithProgress(file, options),
  deleteMedia: (mediaId: string) => apiRequest<void>(`/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" }),
  search: (query: string, type: "all" | "users" | "posts" | "communities" = "all") => apiRequest<ApiSearchResponse>(`/search?q=${encodeURIComponent(query)}&type=${type}`),
  getAdminStats: () => apiRequest<ApiAdminStats>("/admin/stats"),
  getAdminUsers: () => apiRequest<ApiAdminUser[]>("/admin/users"),
  updateAdminUserStatus: (userId: string, status: NonNullable<ApiAdminUser["status"]>) => apiRequest<{ success: true }>(`/admin/users/${encodeURIComponent(userId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAdminTickets: () => apiRequest<ApiAdminTicket[]>("/admin/tickets"),
  updateAdminTicketStatus: (ticketId: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") => apiRequest<{ success: true }>(`/admin/tickets/${encodeURIComponent(ticketId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAdminReports: () => apiRequest<ApiAdminReport[]>("/admin/reports"),
  updateAdminReportStatus: (reportId: string, status: ApiAdminReport["status"]) => apiRequest<{ success: true }>(`/admin/reports/${encodeURIComponent(reportId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

function relativeTime(value?: string | null) {
  if (!value) return "الآن";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

function numericUiId(value: string) { return Array.from(value).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7); }
export function asPerson(user: ApiUser): Person { return { id: numericUiId(user.id), name: user.displayName, handle: `@${user.username}`, avatar: user.avatarUrl || "https://i.pravatar.cc/160?img=12", online: false }; }
export function asPost(post: ApiPost): Post { const media = post.media?.find(item => item.kind === "IMAGE" || item.kind === "VIDEO"); return { id: post.id, author: asPerson(post.author), time: relativeTime(post.publishedAt || post.createdAt), text: post.body, image: media?.publicUrl || media?.url || undefined, mediaKind: media?.kind === "VIDEO" ? "VIDEO" : media?.kind === "IMAGE" ? "IMAGE" : undefined, reactions: post._count.reactions, comments: post._count.comments, shares: post._count.shares }; }
export function asRelativeTime(value?: string | null) { return relativeTime(value); }
