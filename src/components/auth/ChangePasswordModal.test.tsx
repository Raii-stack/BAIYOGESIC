import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import { useAuth } from "./AuthProvider"
import ChangePasswordModal from "./ChangePasswordModal"

vi.mock("./AuthProvider", () => ({ useAuth: vi.fn() }))
vi.mock("../../lib/toast", () => ({ notifyToast: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function setup(overrides: { changePassword?: ReturnType<typeof vi.fn>; logout?: ReturnType<typeof vi.fn> } = {}) {
  const changePassword = overrides.changePassword || vi.fn().mockResolvedValue(undefined)
  const logout = overrides.logout || vi.fn().mockResolvedValue(undefined)
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    changePassword,
    logout,
  })
  render(<ChangePasswordModal />)
  return { changePassword, logout }
}

test("validates required, minimum-length, same-password, and confirmation rules", async () => {
  const user = userEvent.setup()
  const { changePassword } = setup()

  await user.click(screen.getByRole("button", { name: "Update password" }))
  expect(screen.getByText("Enter your current password.")).toBeInTheDocument()
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument()
  expect(changePassword).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText("Current password"), "same-password")
  await user.type(screen.getByLabelText("New password"), "same-password")
  await user.type(screen.getByLabelText("Confirm new password"), "different")
  await user.click(screen.getByRole("button", { name: "Update password" }))
  expect(screen.getByText("Choose a different password.")).toBeInTheDocument()
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument()
})

test("submits valid credentials, clears fields, and traps focus at dialog edges", async () => {
  const user = userEvent.setup()
  const { changePassword } = setup()
  const current = screen.getByLabelText("Current password")
  const next = screen.getByLabelText("New password")
  const confirm = screen.getByLabelText("Confirm new password")

  await user.type(current, "old-password")
  await user.type(next, "New-password1!")
  await user.type(confirm, "New-password1!")
  await user.click(screen.getByRole("button", { name: "Update password" }))

  expect(changePassword).toHaveBeenCalledWith("old-password", "New-password1!")
  await waitFor(() => expect(current).toHaveValue(""))
  expect(next).toHaveValue("")
  expect(confirm).toHaveValue("")

  const dialog = screen.getByRole("dialog", { name: "Set a new password" })
  const signOut = screen.getByRole("button", { name: "Sign out" })
  signOut.focus()
  fireEvent.keyDown(dialog, { key: "Tab" })
  expect(current).toHaveFocus()
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
  expect(signOut).toHaveFocus()
})

test("shows API errors and sign-out errors without losing the form", async () => {
  const user = userEvent.setup()
  const changePassword = vi.fn().mockRejectedValue(new Error("Password was rejected."))
  const logout = vi.fn().mockRejectedValue(new Error("Unable to sign out."))
  setup({ changePassword, logout })

  await user.type(screen.getByLabelText("Current password"), "old-password")
  await user.type(screen.getByLabelText("New password"), "New-password1!")
  await user.type(screen.getByLabelText("Confirm new password"), "New-password1!")
  await user.click(screen.getByRole("button", { name: "Update password" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Password was rejected.")
  expect(screen.getByLabelText("Current password")).toHaveValue("old-password")

  await user.click(screen.getByRole("button", { name: "Sign out" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign out.")
})
