export type AuthenticatedUser = {
  userId: string
  empno: string
  email: string
  role: string
  status: string
}

type LoginResponse = {
  success: boolean
  data?: { user: AuthenticatedUser }
  error?: { message?: string }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ""

export async function login(email: string, password: string) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  let payload: LoginResponse | null = null
  try {
    payload = (await response.json()) as LoginResponse
  } catch {
    throw new Error("Unable to reach the authentication service.")
  }

  if (!response.ok || !payload.success || !payload.data?.user) {
    throw new Error(
      response.status === 401
        ? "Invalid credentials"
        : payload.error?.message || "Unable to sign in. Please try again.",
    )
  }

  return payload.data.user
}
