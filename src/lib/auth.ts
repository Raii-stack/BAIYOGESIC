export type AuthUser = {
  userId: string | number
  empno: string | null
  email: string
  role: string
  status: string
  mustChangePassword: boolean
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
    throw new AuthApiError("Unable to reach the server. Please try again.", 0)
  }

  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) {
    throw new AuthApiError(
      result?.error?.message || "The request could not be completed. Please try again.",
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
}
