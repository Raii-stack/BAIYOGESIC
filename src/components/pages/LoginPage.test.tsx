import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import App from "../../App"

const success = (data: object) => new Response(JSON.stringify({ success: true, data }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
})

const failure = (status: number, message: string) => new Response(
  JSON.stringify({ success: false, error: { message, statusCode: status } }),
  { status, headers: { "Content-Type": "application/json" } },
)

beforeEach(() => {
  window.history.replaceState({}, "", "/login")
  window.dispatchEvent(new PopStateEvent("popstate"))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("default-password users enter the dashboard and must change their password there", async () => {
  const pendingUser = {
    userId: 1,
    empno: "EMP-1",
    email: "user@example.com",
    role: "employee",
    status: "active",
    mustChangePassword: true,
  }
  let sessionChecks = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path.endsWith("/session")) {
      sessionChecks += 1
      return sessionChecks === 1
        ? failure(401, "Authentication required")
        : success({ user: pendingUser })
    }
    if (path.endsWith("/login")) {
      expect(init?.credentials).toBe("include")
      expect(JSON.parse(String(init?.body))).toEqual({ email: "user@example.com", password: "default-pass" })
      return success({ user: pendingUser })
    }
    if (path.endsWith("/change-password")) {
      expect(init?.credentials).toBe("include")
      const body = JSON.parse(String(init?.body))
      if (body.currentPassword === "incorrect") return failure(401, "Current password is incorrect")
      expect(body).toEqual({ currentPassword: "default-pass", newPassword: "a-new-password" })
      return success({ message: "Password updated successfully" })
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<App />)
  expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument()
  await user.type(await screen.findByLabelText("Work email"), "user@example.com")
  await user.type(screen.getByLabelText("Password"), "default-pass")
  await user.click(screen.getByRole("button", { name: "Sign in" }))

  expect(await screen.findByRole("heading", { name: "Welcome back, user@example.com" })).toBeInTheDocument()
  const dialog = await screen.findByRole("dialog", { name: "Set a new password" })
  expect(dialog).toHaveAttribute("aria-modal", "true")
  expect(screen.queryByLabelText("Work email")).not.toBeInTheDocument()

  cleanup()
  render(<App />)
  expect(await screen.findByRole("heading", { name: "Welcome back, user@example.com" })).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Set a new password" })).toBeInTheDocument()

  await user.type(screen.getByLabelText("Current password"), "incorrect")
  await user.type(screen.getByLabelText("New password"), "a-new-password")
  await user.type(screen.getByLabelText("Confirm new password"), "a-new-password")
  await user.click(screen.getByRole("button", { name: "Update password" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect")
  expect(screen.getByRole("dialog")).toBeInTheDocument()

  await user.clear(screen.getByLabelText("Current password"))
  await user.type(screen.getByLabelText("Current password"), "default-pass")
  await user.click(screen.getByRole("button", { name: "Update password" }))

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Set a new password" })).not.toBeInTheDocument())
  expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
    "/api/auth/session",
    "/api/auth/login",
    "/api/auth/session",
    "/api/auth/change-password",
    "/api/auth/change-password",
    "/api/auth/activity",
  ])
})

test("shows a failed login as inline error text", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith("/session")) return failure(401, "Authentication required")
    if (path.endsWith("/login")) return failure(401, "Email or password is incorrect")
    throw new Error(`Unexpected request: ${path}`)
  }))
  const user = userEvent.setup()
  render(<App />)
  await user.type(await screen.findByLabelText("Work email"), "user@example.com")
  await user.type(screen.getByLabelText("Password"), "wrong-password")
  await user.click(screen.getByRole("button", { name: "Sign in" }))
  const error = await screen.findByRole("alert")
  expect(error).toHaveTextContent("Email or password is incorrect")
  expect(error.tagName).toBe("P")
  expect(error).toHaveClass("mt-2", "text-xs", "leading-4", "text-red-600")
  expect(error).not.toHaveClass("bg-red-50")
  expect(screen.getByLabelText("Password").parentElement?.parentElement).toHaveClass("mb-0")
})

test("allows user to open Forgot password and Register modals from login page", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith("/session")) return failure(401, "Authentication required")
    throw new Error(`Unexpected request: ${path}`)
  }))
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole("button", { name: "Forgot password?" }))
  expect(await screen.findByRole("dialog", { name: "Reset password" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Close recovery dialog" }))
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Reset password" })).not.toBeInTheDocument()
  })

  await user.click(screen.getByRole("button", { name: "Register" }))
  expect(await screen.findByRole("dialog", { name: "Create your account" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Close registration dialog" }))
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Create your account" })).not.toBeInTheDocument()
  })
})
