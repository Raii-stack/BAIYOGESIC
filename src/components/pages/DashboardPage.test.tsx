import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { useAuth } from "../auth/AuthProvider"
import * as dashboardApi from "../../lib/dashboard-api"
import DashboardPage from "./DashboardPage"

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }))
vi.mock("../../layouts/DashboardLayout", () => ({ default: ({ children }: { children: import("react").ReactNode }) => <>{children}</> }))
vi.mock("../auth/ChangePasswordModal", () => ({ default: () => <div role="dialog">Change password dialog</div> }))
vi.mock("../dashboard/ActiveEmployees", () => ({ default: () => <div aria-label="Active employees" /> }))

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

test("displays loading skeletons while metrics fetch", () => {
  vi.mocked(useAuth).mockReturnValue({
    user: { userId: "1", empno: "00001", email: "admin@example.com", role: "admin", status: "active", mustChangePassword: false, rights: [] },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })
  // getDashboardStats returns a promise that never resolves during this check
  vi.spyOn(dashboardApi, "getDashboardStats").mockReturnValue(new Promise(() => {}))

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getByLabelText("Loading Customers")).toBeInTheDocument()
  expect(screen.getByLabelText("Loading Products")).toBeInTheDocument()
  expect(screen.getByLabelText("Loading Open Orders")).toBeInTheDocument()
  expect(screen.getByLabelText("Loading Revenue")).toBeInTheDocument()
})

test("displays the 4 KPI metric cards with live formatted values", async () => {
  vi.mocked(useAuth).mockReturnValue({
    user: { userId: "1", empno: "00001", email: "staff@example.com", role: "admin", status: "active", mustChangePassword: false, rights: [] },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(dashboardApi, "getDashboardStats").mockResolvedValueOnce({
    customers: 1248,
    products: 386,
    openOrders: 94,
    revenue: 84200,
  })

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(await screen.findByText("1,248", { selector: ".sr-only" })).toBeInTheDocument()
  expect(screen.getByText("386", { selector: ".sr-only" })).toBeInTheDocument()
  expect(screen.getByText("94", { selector: ".sr-only" })).toBeInTheDocument()
  expect(screen.getByText("$84.2k", { selector: ".sr-only" })).toBeInTheDocument()
})

test("shows permitted module links without a redundant quick-action toolbar", () => {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      userId: "1",
      empno: "00001",
      email: "staff@example.com",
      role: "employee",
      status: "active",
      mustChangePassword: false,
      rights: ["customers.access", "customers.add"],
    },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(dashboardApi, "getDashboardStats").mockResolvedValueOnce({
    customers: 10,
    products: 10,
    openOrders: 2,
    revenue: 500,
  })

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getByRole("link", { name: /^Customers/ })).toHaveAttribute("href", "/customers?view=directory&page=1")
  expect(screen.queryByRole("link", { name: /^Products/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /^Sales/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("toolbar", { name: "Quick actions" })).not.toBeInTheDocument()
})

test("keeps business modules accessible to administrators without duplicate create buttons", () => {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      userId: "1",
      empno: "00001",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      mustChangePassword: false,
      rights: [],
    },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(dashboardApi, "getDashboardStats").mockResolvedValueOnce({
    customers: 100,
    products: 50,
    openOrders: 10,
    revenue: 25000,
  })

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getByRole("link", { name: /^Customers/ })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /^Products/ })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /^Sales/ })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /New Customer|New Product|New Sale/ })).not.toBeInTheDocument()
})

test("does not initiate stats fetch when user must first change password", () => {
  const getDashboardStatsSpy = vi.spyOn(dashboardApi, "getDashboardStats")

  vi.mocked(useAuth).mockReturnValue({
    user: {
      userId: "1",
      empno: "00001",
      email: "staff@example.com",
      role: "admin",
      status: "active",
      mustChangePassword: true,
      rights: [],
    },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(getDashboardStatsSpy).not.toHaveBeenCalled()
})


test("displays error alert and supports retry when stats loading fails", async () => {
  const getDashboardStatsSpy = vi
    .spyOn(dashboardApi, "getDashboardStats")
    .mockRejectedValueOnce(new Error("Network connection lost"))
    .mockResolvedValueOnce({
      customers: 50,
      products: 25,
      openOrders: 5,
      revenue: 1000,
    })

  vi.mocked(useAuth).mockReturnValue({
    user: {
      userId: "1",
      empno: "00001",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      mustChangePassword: false,
      rights: [],
    },
    loading: false,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  })

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent("Network connection lost")

  const retryButton = screen.getByRole("button", { name: "Try again" })
  fireEvent.click(retryButton)

  expect(await screen.findByText("50", { selector: ".sr-only" })).toBeInTheDocument()
  expect(getDashboardStatsSpy).toHaveBeenCalledTimes(2)
})
