import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { AuthApiError, authApi } from "../../lib/auth"
import { AuthProvider, useAuth } from "./AuthProvider"

vi.mock("../../lib/auth", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth")>("../../lib/auth")
  return {
    ...actual,
    authApi: {
      session: vi.fn(),
      login: vi.fn(),
      changePassword: vi.fn(),
      logout: vi.fn(),
    },
  }
})

const user = {
  userId: "1",
  empno: "00001",
  email: "user@example.com",
  role: "employee",
  status: "active",
  mustChangePassword: true,
}

function Harness() {
  const auth = useAuth()
  return (
    <>
      <output aria-label="state">{auth.loading ? "loading" : auth.user?.email || "signed out"}</output>
      <button type="button" onClick={() => void auth.login("  USER@EXAMPLE.COM ", "password")}>Login</button>
      <button type="button" onClick={() => void auth.changePassword("old", "new")}>Change password</button>
      <button type="button" onClick={() => void auth.logout()}>Logout</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  vi.mocked(authApi.session).mockResolvedValue({ user: null })
  vi.mocked(authApi.login).mockResolvedValue({ user })
  vi.mocked(authApi.changePassword).mockResolvedValue({ message: "ok" })
  vi.mocked(authApi.logout).mockResolvedValue({ message: "ok" })
})

test("restores a session and clears it when the session-expired event fires", async () => {
  vi.mocked(authApi.session).mockResolvedValue({ user })
  render(<AuthProvider><Harness /></AuthProvider>)

  expect(await screen.findByLabelText("state")).toHaveTextContent("user@example.com")
  window.dispatchEvent(new Event("hope:session-expired"))
  await waitFor(() => expect(screen.getByLabelText("state")).toHaveTextContent("signed out"))
})

test("normalizes login input and updates mustChangePassword after changing password", async () => {
  const userEventApi = userEvent.setup()
  render(<AuthProvider><Harness /></AuthProvider>)

  await screen.findByLabelText("state")
  await userEventApi.click(screen.getByRole("button", { name: "Login" }))
  expect(authApi.login).toHaveBeenCalledWith("user@example.com", "password")
  expect(screen.getByLabelText("state")).toHaveTextContent("user@example.com")

  await userEventApi.click(screen.getByRole("button", { name: "Change password" }))
  expect(authApi.changePassword).toHaveBeenCalledWith("old", "new")
})

test("clears the user on logout and tolerates an already-expired session", async () => {
  const userEventApi = userEvent.setup()
  vi.mocked(authApi.session).mockResolvedValue({ user })
  render(<AuthProvider><Harness /></AuthProvider>)
  await screen.findByText("user@example.com")

  vi.mocked(authApi.logout).mockRejectedValueOnce(new AuthApiError("expired", 401))
  await userEventApi.click(screen.getByRole("button", { name: "Logout" }))
  expect(screen.getByLabelText("state")).toHaveTextContent("signed out")
})
