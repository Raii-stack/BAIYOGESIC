import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import ToastHost from "../common/ToastHost"
import ResetPasswordPage from "./ResetPasswordPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

const response = (data: object) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json" } })

test("does not claim a reset link is verified when no token is present", () => {
  render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>)
  expect(screen.getByText(/valid password-reset link is required/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Update Password" })).not.toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login")
})

test("submits a reset token to the API and shows a real success toast", async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (String(_input).endsWith('/validate')) return response({ status: "valid", expiresAt: new Date(Date.now() + 600000).toISOString() })
    expect(JSON.parse(String(init?.body))).toEqual({ token: "a".repeat(64), password: "new-password-123" })
    return new Response(JSON.stringify({ success: true, data: { user: {} } }), { status: 200, headers: { "Content-Type": "application/json" } })
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[`/reset-password#token=${"a".repeat(64)}`]}><ToastHost /><ResetPasswordPage /></MemoryRouter>)
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument()
  await user.type(await screen.findByLabelText("New Password"), "new-password-123")
  await user.type(screen.getByLabelText("Confirm New Password"), "new-password-123")
  await user.click(screen.getByRole("button", { name: "Update Password" }))
  expect((await screen.findAllByRole("status")).some((item) => item.textContent?.includes("Password updated"))).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test.each([['expired', 'Reset link expired'], ['used', 'Reset link already used'], ['invalid', 'Invalid reset link']])("shows a distinct %s screen before any password entry", async (status, heading) => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ status })))
  render(<MemoryRouter initialEntries={[`/reset-password#token=${"a".repeat(64)}`]}><ResetPasswordPage /></MemoryRouter>)
  expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument()
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Request a new reset link" }))
  expect(screen.getByRole("dialog", { name: "Reset password" })).toBeInTheDocument()
})

test("does not label a network failure as an expired link and allows retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({ status: "valid", expiresAt: new Date(Date.now() + 600000).toISOString() })))
  render(<MemoryRouter initialEntries={[`/reset-password#token=${"a".repeat(64)}`]}><ResetPasswordPage /></MemoryRouter>)
  expect(await screen.findByRole("heading", { name: "Unable to check this link" })).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByLabelText("New Password")).toBeInTheDocument()
})

test("replaces an active form when the link expires while the page is open", async () => {
  vi.useFakeTimers()
  vi.stubGlobal("fetch", vi.fn(async () => response({ status: "valid", expiresAt: new Date(Date.now() + 1000).toISOString() })))
  await act(async () => { render(<MemoryRouter initialEntries={[`/reset-password#token=${"a".repeat(64)}`]}><ResetPasswordPage /></MemoryRouter>) })
  expect(screen.getByLabelText("New Password")).toBeInTheDocument()
  await act(async () => { vi.advanceTimersByTime(1001) })
  expect(screen.getByRole("heading", { name: "Reset link expired" })).toBeInTheDocument()
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument()
})

test("rechecks the link when another tab has used it before submission", async () => {
  let validations = 0
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/validate')) return response(++validations === 1 ? { status: "valid", expiresAt: new Date(Date.now() + 600000).toISOString() } : { status: "used" })
    return new Response(JSON.stringify({ success: false, error: { message: "Invalid or expired reset token" } }), { status: 400 })
  }))
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[`/reset-password#token=${"a".repeat(64)}`]}><ResetPasswordPage /></MemoryRouter>)
  await user.type(await screen.findByLabelText("New Password"), "new-password-123")
  await user.type(screen.getByLabelText("Confirm New Password"), "new-password-123")
  await user.click(screen.getByRole("button", { name: "Update Password" }))
  expect(await screen.findByRole("heading", { name: "Reset link already used" })).toBeInTheDocument()
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument()
})
