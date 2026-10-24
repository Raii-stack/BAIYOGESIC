import { safeApiMessage } from "./api-errors"

export type AuthUser = {
  userId: string | number
  empno: string | null
  firstName?: string
  lastName?: string
  name?: string
  email: string
  role: string
  status: string
  isBlocked?: boolean
  mustChangePassword: boolean
  jobTitle?: string | null
  departmentName?: string | null
  rights?: string[]
}

export function getUserDisplayName(user: AuthUser | null | undefined): string {
  return user?.name?.trim()
    || [user?.firstName, user?.lastName].filter(Boolean).join(" ")
    || user?.email
    || "Workspace user"
}

export function getUserInitials(user: AuthUser | null | undefined): string {
  const name = getUserDisplayName(user)
  const parts = name.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : name.slice(0, 2)).toUpperCase()
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === "superadmin" || role === "administrator"
}

export function isAdminRole(role?: string | null): boolean {
  return isSuperAdminRole(role) || role === "admin"
}

export function hasUserRight(user: AuthUser | null | undefined, ...rightCodes: string[]): boolean {
  if (!user) return false
  if (isAdminRole(user.role)) return true
  if (!Array.isArray(user.rights)) return false
  return rightCodes.some((code) => user.rights!.includes(code))
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message?: string }
}

export class AuthApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, body?: object): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new AuthApiError("The service is temporarily unavailable. Please try again.", 0)
  }

  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) {
    const authDetail = result?.error?.message
    const knownAuthError =
      (response.status === 401 && authDetail &&
        /^(Email or password is incorrect|Invalid email or password|Current password is incorrect)\.?$/i.test(authDetail)) ||
      (response.status === 403 && authDetail && /blocked/i.test(authDetail))
    throw new AuthApiError(
      knownAuthError ? authDetail : safeApiMessage(response.status, result),
      response.status,
    )
  }
  return result.data
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>("/login", { email, password }),
  session: () => request<{ user: AuthUser }>("/session"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/change-password", { currentPassword, newPassword }),
  logout: () => request<{ message: string }>("/logout", {}),
  resetPassword: (token: string, password: string) => request<{ user: AuthUser }>("/reset-password", { token, password }),
}
