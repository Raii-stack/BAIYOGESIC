import { afterEach, describe, expect, it, vi } from "vitest"
import {
  AuthApiError,
  authApi,
  getUserDisplayName,
  getUserInitials,
  hasUserRight,
  isAdminRole,
  isSuperAdminRole,
  type AuthUser,
} from "./auth"

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: "u-1",
    empno: "00001",
    email: "alex@hope.inc",
    role: "employee",
    status: "Active",
    mustChangePassword: false,
    ...overrides,
  }
}

describe("auth identity and permission helpers", () => {
  it("derives display names and initials from profile hierarchy", () => {
    expect(getUserDisplayName(makeUser({ name: "  Alex Montes  ", firstName: "Ignored" }))).toBe("Alex Montes")
    expect(getUserDisplayName(makeUser({ firstName: "Jane", lastName: "Doe" }))).toBe("Jane Doe")
    expect(getUserDisplayName(makeUser())).toBe("alex@hope.inc")
    expect(getUserDisplayName(null)).toBe("Workspace user")

    expect(getUserInitials(makeUser({ name: "Maria Clara Reyes" }))).toBe("MR")
    expect(getUserInitials(makeUser({ name: "Cher" }))).toBe("CH")
  })

  it("evaluates super-admin, admin, it_admin block, and scoped rights accurately", () => {
    expect(isSuperAdminRole(" SuperAdmin ")).toBe(true)
    expect(isSuperAdminRole("administrator")).toBe(true)
    expect(isSuperAdminRole("admin")).toBe(false)

    expect(isAdminRole("admin")).toBe(true)
    expect(isAdminRole("superadmin")).toBe(true)
    expect(isAdminRole("it_admin")).toBe(false)

    expect(hasUserRight(makeUser({ role: "it_admin", rights: ["INVENTORY_VIEW"] }), "INVENTORY_VIEW")).toBe(false)
    expect(hasUserRight(makeUser({ role: "admin" }), "ANY_RIGHT")).toBe(true)
    expect(hasUserRight(makeUser({ rights: ["SALES_CREATE"] }), "SALES_CREATE", "SALES_VOID")).toBe(true)
    expect(hasUserRight(makeUser({ rights: ["SALES_VIEW"] }), "SALES_CREATE")).toBe(false)
    expect(hasUserRight(null, "SALES_VIEW")).toBe(false)
  })
})

describe("authApi client", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("posts credentials, validates reset tokens, and registers accounts with credentials included", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { user: makeUser({ role: "admin" }) },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { status: "valid", expiresAt: "2026-12-01T00:00:00Z" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { message: "Registered", user: makeUser({ status: "Pending" }) },
      }), { status: 201 }))

    const loginResult = await authApi.login("alex@hope.inc", "Secret123!")
    expect(loginResult.user.role).toBe("admin")
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/login", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }))

    const tokenResult = await authApi.validateResetToken("tok-123")
    expect(tokenResult.status).toBe("valid")

    const regResult = await authApi.register({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@hope.inc",
      password: "Password123!",
      verificationCode: "123456",
    })
    expect(regResult.user.status).toBe("Pending")
  })

  it("preserves known 401/403 messages and validates registration notification payloads", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: { message: "Email or password is incorrect." },
      }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: { message: "Your account is pending approval. Contact HR or an administrator." },
      }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { total: 2, registrations: [{ userId: "u1", name: "Jane", email: "jane@hope.inc", createdAt: "2026-11-10T00:00:00Z" }] },
      }), { status: 200 }))

    await expect(authApi.login("a@hope.inc", "bad")).rejects.toMatchObject({
      name: "Error",
      message: "Email or password is incorrect.",
      status: 401,
    })
    await expect(authApi.login("a@hope.inc", "ok")).rejects.toMatchObject({
      message: "Your account is pending approval. Contact HR or an administrator.",
      status: 403,
    })

    const notices = await authApi.registrationNotifications()
    expect(notices.total).toBe(2)
    expect(notices.registrations).toHaveLength(1)
  })

  it("wraps non-abort network errors into AuthApiError(0) and rethrows aborted requests", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await expect(authApi.session()).rejects.toEqual(
      new AuthApiError("The service is temporarily unavailable. Please try again.", 0),
    )

    const controller = new AbortController()
    controller.abort()
    const abortErr = new DOMException("Aborted", "AbortError")
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortErr)
    await expect(authApi.activeEmployees(controller.signal)).rejects.toBe(abortErr)
  })
})
