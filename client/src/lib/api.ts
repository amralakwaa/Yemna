import type { Person, Post } from "./yemnaData";

const API_BASE = "/api/v1";
const ACCESS_TOKEN_KEY = "yemna_access_token";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export type ApiUser = { id: string; displayName: string; username: string; avatarUrl?: string | null; bio?: string | null; city?: string | null; governorate?: string | null; createdAt?: string };
export type ApiMedia = { url?: string | null; kind?: string };
export type ApiPost = { id: string; body: string; publishedAt?: string | null; createdAt: string; author: ApiUser; media?: ApiMedia[]; _count: { comments: number; reactions: number; shares: number } };
export type FeedResponse = { items: ApiPost[]; nextCursor: string | null };
export type ApiMessage = { id: string; body: string; createdAt: string; sender: ApiUser; conversationId: string };
export type ApiConversation = { id: string; kind: "DIRECT" | "GROUP"; title?: string | null; participants: Array<{ user: ApiUser }>; messages?: ApiMessage[]; lastReadAt?: string | null };
export type ApiNotification = { id: string; type: string; title: string; body?: string | null; linkUrl?: string | null; createdAt: string; readAt?: string | null; actor?: ApiUser | null };
type AuthResponse = { accessToken: string; user: ApiUser };

function readAccessToken() { try { return sessionStorage.getItem(ACCESS_TOKEN_KEY); } catch { return null; } }
export function getRestAccessToken() { return readAccessToken(); }
export function hasRestSession() { return Boolean(readAccessToken()); }
export function setRestAccessToken(token: string) { try { sessionStorage.setItem(ACCESS_TOKEN_KEY, token); } catch { /* session storage is unavailable */ } }
export function clearRestAccessToken() { try { sessionStorage.removeItem(ACCESS_TOKEN_KEY); } catch { /* session storage is unavailable */ } }

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readAccessToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join("، ") : payload.message || "تعذر إكمال الطلب";
    if (response.status === 401) clearRestAccessToken();
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

export const api = {
  register: (payload: { displayName: string; email?: string; phone?: string; password: string }) => apiRequest<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (identifier: string, password: string) => apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  getFeed: () => apiRequest<FeedResponse>("/posts?limit=20"),
  createPost: (body: string) => apiRequest<ApiPost>("/posts", { method: "POST", body: JSON.stringify({ body, visibility: "PUBLIC" }) }),
  getMe: () => apiRequest<ApiUser>("/users/me"),
  getUser: (username: string) => apiRequest<ApiUser>(`/users/${encodeURIComponent(username)}`),
  getConversations: () => apiRequest<ApiConversation[]>("/messages/conversations"),
  getConversationMessages: (conversationId: string) => apiRequest<ApiMessage[]>(`/messages/conversations/${encodeURIComponent(conversationId)}`),
  sendMessage: (conversationId: string, body: string) => apiRequest<ApiMessage>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  markConversationRead: (conversationId: string) => apiRequest<{ success: true }>(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: "PATCH" }),
  getNotifications: () => apiRequest<ApiNotification[]>("/notifications"),
  markNotificationRead: (notificationId: string) => apiRequest<ApiNotification>(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH" }),
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
export function asPost(post: ApiPost): Post { return { id: post.id, author: asPerson(post.author), time: relativeTime(post.publishedAt || post.createdAt), text: post.body, image: post.media?.find(media => media.kind === "IMAGE" || media.kind === "VIDEO")?.url || undefined, reactions: post._count.reactions, comments: post._count.comments, shares: post._count.shares }; }
export function asRelativeTime(value?: string | null) { return relativeTime(value); }
