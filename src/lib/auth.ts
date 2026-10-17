export type AuthenticatedUser = {
  userId: string
  empno: string
  email: string
  role: string
  status: string
}

const currentUserStorageKey = "hope-erp-current-user"

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

export function saveCurrentUser(user: AuthenticatedUser) {
  window.localStorage.setItem(currentUserStorageKey, JSON.stringify(user))
}

export function getCurrentUser(): AuthenticatedUser | null {
  const storedUser = window.localStorage.getItem(currentUserStorageKey)
  if (!storedUser) return null

  try {
    return JSON.parse(storedUser) as AuthenticatedUser
  } catch {
    window.localStorage.removeItem(currentUserStorageKey)
    return null
  }
}

export function getUserInitials(user: AuthenticatedUser | null) {
  if (!user) return "SA"

  const [lastName = "", firstName = ""] = user.email.split("@")[0].split(".")
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "SA"
}

export function getUserDisplayName(user: AuthenticatedUser | null) {
  if (!user) return "Account"

  const [lastName, firstName] = user.email.split("@")[0].split(".")
  if (!lastName || !firstName) return user.email

  return `${firstName} ${lastName}`.replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  )
}

export function getUserRoleLabel(user: AuthenticatedUser | null) {
  if (!user) return "Superadmin"
  if (user.role === "administrator") return "Superadmin"

  return user.role.charAt(0).toUpperCase() + user.role.slice(1)
}
