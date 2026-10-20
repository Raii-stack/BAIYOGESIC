import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import ToastHost from "../common/ToastHost"
import ResetPasswordPage from "./ResetPasswordPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test("does not claim a reset link is verified when no token is present", () => {
  render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>)
  expect(screen.getByText(/valid password-reset link is required/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Update Password" })).not.toBeInTheDocument()
})

test("submits a reset token to the API and shows a real success toast", async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body))).toEqual({ token: "a".repeat(64), password: "new-password-123" })
    return new Response(JSON.stringify({ success: true, data: { user: {} } }), { status: 200, headers: { "Content-Type": "application/json" } })
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[`/reset-password?token=${"a".repeat(64)}`]}><ToastHost /><ResetPasswordPage /></MemoryRouter>)
  await user.type(screen.getByLabelText("New Password"), "new-password-123")
  await user.type(screen.getByLabelText("Confirm New Password"), "new-password-123")
  await user.click(screen.getByRole("button", { name: "Update Password" }))
  expect((await screen.findAllByRole("status")).some((item) => item.textContent?.includes("Password updated"))).toBe(true)
  expect(fetchMock).toHaveBeenCalledOnce()
})
