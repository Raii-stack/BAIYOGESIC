import { safeApiMessage } from "./api-errors"

export const defaultPreferences = { density: "comfortable" as "comfortable" | "compact", motion: true, employment: true, sales: true, payments: true, products: true, popups: true }
export type Preferences = typeof defaultPreferences
export type NotificationItem = { id: string; category: string; title: string; message: string; createdAt: string; readAt: string | null }
export type Inbox = { items: NotificationItem[]; unreadCount: number; total: number; page: number; totalPages: number }
export const emptyInbox: Inbox = { items: [], unreadCount: 0, total: 0, page: 1, totalPages: 1 }
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}/api/me${path}`, { method, credentials: "include", signal,
    headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json().catch(() => null)
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError")
  if (!response.ok || !result?.success || !result.data) {
    if (response.status === 401) window.dispatchEvent(new Event("hope:session-expired"))
    throw new Error(safeApiMessage(response.status, result))
  }
  return result.data
}

export const workspaceApi = {
  async preferences(signal?: AbortSignal) {
    const result = await request<{ preferences: Preferences }>("/preferences", "GET", undefined, signal)
    if (!result.preferences || !["comfortable", "compact"].includes(result.preferences.density)
      || Object.keys(defaultPreferences).some((key) => key !== "density" && typeof result.preferences[key as keyof Preferences] !== "boolean")) throw new Error("Unable to load preferences.")
    return result.preferences
  },
  async savePreferences(preferences: Preferences) {
    return (await request<{ preferences: Preferences }>("/preferences", "PATCH", preferences)).preferences
  },
  async inbox(page = 1, signal?: AbortSignal) {
    const result = await request<Inbox>(`/notifications?page=${page}`, "GET", undefined, signal)
    if (!Array.isArray(result.items) || !Number.isInteger(result.unreadCount)) throw new Error("Unable to load notifications.")
    return result
  },
  read: (id: string) => request(`/notifications/${encodeURIComponent(id)}/read`, "PATCH"),
  readAll: () => request("/notifications/read-all", "POST"),
  open: (id: string) => request<{ href: string | null }>(`/notifications/${encodeURIComponent(id)}/open`),
}
