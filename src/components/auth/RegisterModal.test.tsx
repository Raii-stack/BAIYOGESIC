import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import { authApi } from "../../lib/auth"
import RegisterModal from "./RegisterModal"

vi.mock("../../lib/auth", () => ({
  authApi: {
    register: vi.fn(),
  },
}))
vi.mock("../../lib/toast", () => ({ notifyToast: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("validates required fields, email format, password length, and password match", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<RegisterModal open={true} onClose={onClose} />)

  expect(screen.getByRole("dialog", { name: "Create your account" })).toBeInTheDocument()
  expect(screen.getAllByText(/User \(Employee\)/).length).toBeGreaterThan(0)

  await user.click(screen.getByRole("button", { name: "Register account" }))
  expect(screen.getByText("First name is required.")).toBeInTheDocument()
  expect(screen.getByText("Last name is required.")).toBeInTheDocument()
  expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument()
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument()
  expect(authApi.register).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText("First name"), "Jane")
  await user.type(screen.getByLabelText("Last name"), "Doe")
  await user.type(screen.getByLabelText("Work email"), "jane.doe@hope.inc")
  await user.type(screen.getByLabelText("Password"), "short")
  await user.type(screen.getByLabelText("Confirm password"), "mismatch")

  await user.click(screen.getByRole("button", { name: "Register account" }))
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument()
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument()
  expect(authApi.register).not.toHaveBeenCalled()
})

test("submits valid credentials and renders registration success state", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  vi.mocked(authApi.register).mockResolvedValueOnce({
    message: "Account created successfully",
    user: {
      userId: "101",
      empno: "00099",
      email: "jane.doe@hope.inc",
      role: "employee",
      status: "pending",
      mustChangePassword: false,
    },
  })

  render(<RegisterModal open={true} onClose={onClose} onSuccess={onSuccess} />)

  await user.type(screen.getByLabelText("First name"), "Jane")
  await user.type(screen.getByLabelText("Last name"), "Doe")
  await user.type(screen.getByLabelText("Work email"), "jane.doe@hope.inc")
  await user.type(screen.getByLabelText("Password"), "SecurePass123!")
  await user.type(screen.getByLabelText("Confirm password"), "SecurePass123!")

  await user.click(screen.getByRole("button", { name: "Register account" }))

  await waitFor(() => {
    expect(authApi.register).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@hope.inc",
      password: "SecurePass123!",
    })
  })

  expect(await screen.findByRole("status")).toHaveTextContent("Your account is pending approval.")
  expect(onSuccess).toHaveBeenCalledOnce()

  await user.click(screen.getByRole("button", { name: "Done" }))
  expect(onClose).toHaveBeenCalledOnce()
})

test("displays server error when registration fails and handles Escape key", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  vi.mocked(authApi.register).mockRejectedValueOnce(new Error("A user with that email already exists"))

  render(<RegisterModal open={true} onClose={onClose} />)

  await user.type(screen.getByLabelText("First name"), "Jane")
  await user.type(screen.getByLabelText("Last name"), "Doe")
  await user.type(screen.getByLabelText("Work email"), "duplicate@hope.inc")
  await user.type(screen.getByLabelText("Password"), "SecurePass123!")
  await user.type(screen.getByLabelText("Confirm password"), "SecurePass123!")

  await user.click(screen.getByRole("button", { name: "Register account" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("A user with that email already exists")

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(onClose).toHaveBeenCalledOnce()
})
