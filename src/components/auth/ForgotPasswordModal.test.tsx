import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import { authApi } from "../../lib/auth"
import ForgotPasswordModal from "./ForgotPasswordModal"

vi.mock("../../lib/auth", () => ({
  authApi: {
    forgotPassword: vi.fn(),
  },
}))
vi.mock("../../lib/toast", () => ({ notifyToast: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("validates work email format before submitting", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<ForgotPasswordModal open={true} onClose={onClose} />)

  expect(screen.getByRole("dialog", { name: "Reset password" })).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Send reset link" }))
  expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument()
  expect(authApi.forgotPassword).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText("Work email"), "not-valid-email")
  await user.click(screen.getByRole("button", { name: "Send reset link" }))
  expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument()
  expect(authApi.forgotPassword).not.toHaveBeenCalled()
})

test("submits valid email and renders recovery confirmation state", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({
    message: "Password reset link generated successfully.",
    token: "mock-token-xyz123",
  })

  render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />)

  await user.type(screen.getByLabelText("Work email"), "staff@hope.inc")
  await user.click(screen.getByRole("button", { name: "Send reset link" }))

  await waitFor(() => {
    expect(authApi.forgotPassword).toHaveBeenCalledWith("staff@hope.inc")
  })

  expect(await screen.findByRole("status")).toHaveTextContent("Reset instructions sent!")
  expect(screen.getByText(/mock-token-xyz123/)).toBeInTheDocument()
  expect(onSuccess).toHaveBeenCalledOnce()

  await user.click(screen.getByRole("button", { name: "Return to sign in" }))
  expect(onClose).toHaveBeenCalledOnce()
})

test("surfaces server errors and supports Escape key to close", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  vi.mocked(authApi.forgotPassword).mockRejectedValueOnce(new Error("Authentication service unavailable"))

  render(<ForgotPasswordModal open={true} onClose={onClose} />)

  await user.type(screen.getByLabelText("Work email"), "error@hope.inc")
  await user.click(screen.getByRole("button", { name: "Send reset link" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Authentication service unavailable")

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(onClose).toHaveBeenCalledOnce()
})
