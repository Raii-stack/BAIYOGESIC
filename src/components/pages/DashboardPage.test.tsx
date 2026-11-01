import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { useAuth } from "../auth/AuthProvider"
import DashboardPage from "./DashboardPage"

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }))
vi.mock("../../layouts/DashboardLayout", () => ({ default: ({ children }: { children: import("react").ReactNode }) => <>{children}</> }))
vi.mock("../auth/ChangePasswordModal", () => ({ default: () => <div role="dialog">Change password dialog</div> }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("explains the empty workspace when no modules are permitted", () => {
  vi.mocked(useAuth).mockReturnValue({
    user: { userId: "1", empno: "00001", email: "staff@example.com", role: "employee", status: "active", mustChangePassword: false, rights: [] },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })
  render(<DashboardPage />)

  expect(screen.getByText("Your workspace is getting ready")).toBeInTheDocument()
  expect(screen.getByText(/You don’t have access to any business tools yet/)).toBeInTheDocument()
  expect(screen.getByText("0")).toBeInTheDocument()
})

test("renders department context and the mandatory password dialog", () => {
  vi.mocked(useAuth).mockReturnValue({
    user: { userId: "1", empno: "00001", email: "staff@example.com", role: "employee", departmentName: "Sales", status: "active", mustChangePassword: true, rights: ["sales.access"] },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getAllByText("Sales").length).toBeGreaterThan(0)
  expect(screen.getByRole("dialog")).toHaveTextContent("Change password dialog")
  expect(screen.getByText("Available tools").parentElement).toHaveTextContent("1")
})
