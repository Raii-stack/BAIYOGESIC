import { apiFailure } from "./api-errors"

export type AuditLogEntry = {
  auditId: string
  tableName: string
  action: string
  recordKey: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  actionBy: string
  actionAt: string
}

export type AuditLogPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type AuditLogFilters = {
  tableName?: string
  action?: string
  username?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export type AuditLogResult = {
  logs: Omit<AuditLogEntry, "oldValues" | "newValues">[]
  pagination: AuditLogPagination
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message?: string }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/audit-logs${path}`, { credentials: "include", signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw apiFailure(0)
  }
  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) throw apiFailure(response.status, result)
  return result.data
}

export const auditLogApi = {
  async get(id: string, signal?: AbortSignal): Promise<AuditLogEntry> {
    const data = await request<{ log: AuditLogEntry }>(`/${encodeURIComponent(id)}`, signal)
    if (!data.log) throw apiFailure(502)
    return data.log
  },
  async list(filters: AuditLogFilters = {}, signal?: AbortSignal): Promise<AuditLogResult> {
    const params = new URLSearchParams()
    if (filters.tableName) params.set("tableName", filters.tableName)
    if (filters.action) params.set("action", filters.action)
    if (filters.username) params.set("username", filters.username)
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.page) params.set("page", String(filters.page))
    if (filters.limit) params.set("limit", String(filters.limit))

    const query = params.toString() ? `?${params.toString()}` : ""

    return request<AuditLogResult>(query, signal)
  },
}
