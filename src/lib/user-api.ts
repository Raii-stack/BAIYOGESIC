import type { AvailableEmployee, SystemUser, UserRole } from "../types/user"
import { apiFailure } from "./api-errors"

export type UserPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type UserCreateInput = {
  empno?: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  password: string
  mustChangePassword?: boolean
  rights?: string[]
}

export type UserUpdateInput = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  password?: string
  mustChangePassword?: boolean
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message?: string }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/users${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw apiFailure(0)
  }

  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) {
    throw apiFailure(response.status, result)
  }
  return result.data
}

export function normalizeUserRow(raw: Partial<SystemUser> & { userId: string; email: string }): SystemUser {
  const firstName = raw.firstName ?? ""
  const lastName = raw.lastName ?? ""
  const fullName = (raw.name || `${firstName} ${lastName}`).trim() || raw.email
  const role: UserRole =
    raw.role === "superadmin" || raw.role === "admin" || raw.role === "employee"
      ? raw.role
      : "employee"
  return {
    userId: String(raw.userId),
    empno: raw.empno ?? null,
    firstName,
    lastName,
    name: fullName,
    email: raw.email,
    role,
    status: raw.status ?? "active",
    isBlocked: Boolean(raw.isBlocked),
    mustChangePassword: Boolean(raw.mustChangePassword),
    jobTitle: raw.jobTitle ?? null,
    departmentName: raw.departmentName ?? null,
    stamp: raw.stamp ?? null,
    rights: Array.isArray(raw.rights) ? raw.rights : [],
  }
}

export const userApi = {
  async list(
    options: {
      page: number
      limit: number
      search: string
      role: "all" | UserRole
      status: "all" | "active" | "blocked" | "pending"
    },
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      page: String(options.page),
      limit: String(options.limit),
    })
    if (options.search) params.set("search", options.search)
    if (options.role !== "all") params.set("role", options.role)
    if (options.status !== "all") params.set("status", options.status)
    const data = await request<{ users: SystemUser[]; pagination: UserPagination }>(
      `?${params}`,
      "GET",
      undefined,
      signal,
    )
    return {
      users: data.users.map(normalizeUserRow),
      pagination: data.pagination,
    }
  },
  options: (signal?: AbortSignal) =>
    request<{ availableEmployees: AvailableEmployee[] }>("/options", "GET", undefined, signal),
  async create(input: UserCreateInput) {
    const data = await request<{ user: SystemUser }>("", "POST", input)
    return normalizeUserRow(data.user)
  },
  async update(userId: string, input: UserUpdateInput) {
    const data = await request<{ user: SystemUser }>(
      `/${encodeURIComponent(userId)}`,
      "PUT",
      input,
    )
    return normalizeUserRow(data.user)
  },
  async approve(userId: string) {
    const data = await request<{ user: SystemUser }>(
      `/${encodeURIComponent(userId)}/approve`,
      "POST",
    )
    return normalizeUserRow(data.user)
  },
  async setBlocked(userId: string, isBlocked: boolean) {
    const data = await request<{ user: SystemUser }>(
      `/${encodeURIComponent(userId)}/block`,
      "PATCH",
      { isBlocked },
    )
    return normalizeUserRow(data.user)
  },
  async updateRights(userId: string, rights: string[], role: UserRole) {
    const data = await request<{ user: SystemUser }>(
      `/${encodeURIComponent(userId)}/rights`,
      "PUT",
      { rights, role },
    )
    return normalizeUserRow(data.user)
  },
}
