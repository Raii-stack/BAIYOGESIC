import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { ProtectedPage } from "./App"
import { AuthProvider } from "./components/auth/AuthProvider"
import DashboardPage from "./components/pages/DashboardPage"
import ReportsPage from "./pages/ReportsPage"
import SalesManagementPage from "./pages/SalesManagementPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const response = (status: number, data?: object) => new Response(JSON.stringify(data ? { success: true, data } : { success: false, error: { message: "Authentication required" } }), { status, headers: { "Content-Type": "application/json" } })

function renderGuard(role?: string, mustChangePassword = false) {
  vi.stubGlobal("fetch", vi.fn(async () => role ? response(200, { user: { userId: "1", empno: null, email: "example@example.com", role, status: "active", mustChangePassword } }) : response(401)))
  render(<MemoryRouter initialEntries={["/users"]}><AuthProvider><Routes>
    <Route path="/users" element={<ProtectedPage roles={["administrator", "admin"]}><div>Private accounts</div></ProtectedPage>} />
    <Route path="/dashboard" element={<div>Dashboard</div>} />
    <Route path="/" element={<div>Sign in</div>} />
  </Routes></AuthProvider></MemoryRouter>)
}

test("redirects visitors and default-password users away from protected pages", async () => {
  renderGuard()
  expect(await screen.findByText("Sign in")).toBeInTheDocument()
  cleanup()
  renderGuard("administrator", true)
  expect(await screen.findByText("Sign in")).toBeInTheDocument()
})

test("reserves user management for administrators", async () => {
  renderGuard("employee")
  expect(await screen.findByText("Dashboard")).toBeInTheDocument()
  cleanup()
  renderGuard("administrator")
  expect(await screen.findByText("Private accounts")).toBeInTheDocument()
})

test("filters dashboard tiles, sidebar links, sales actions, and report tabs based on user rights", async () => {
  const scopedEmployee = {
    userId: "emp-1",
    empno: "00010",
    email: "agent@hope.inc",
    role: "employee",
    status: "active",
    mustChangePassword: false,
    rights: ["sales.access", "sales.details.view", "reports.access", "reports.top-sales"],
  }
  vi.stubGlobal("fetch", vi.fn(async () => response(200, { user: scopedEmployee })))

  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
          <Route path="/customers" element={<ProtectedPage module="customers"><div>CRM Page</div></ProtectedPage>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole("heading", { name: "Main Dashboard" })).toBeInTheDocument()
  // Permitted modules are shown
  expect(screen.getAllByText("Sales").length).toBeGreaterThan(0)
  expect(screen.getAllByText("Reports").length).toBeGreaterThan(0)
  // Unpermitted modules are hidden from sidebar and tiles
  expect(screen.queryByText("CRM")).not.toBeInTheDocument()
  expect(screen.queryByText("Inventory")).not.toBeInTheDocument()
  expect(screen.queryByText("Human Resources")).not.toBeInTheDocument()
  expect(screen.queryByText("User Management")).not.toBeInTheDocument()

  cleanup()

  // Verify Sales page hides "+ New Sale", "Edit", "Delete", and audit columns when not granted
  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <AuthProvider>
        <SalesManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole("heading", { name: "Sales Management" })).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "+ New Sale" })).not.toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Stamp" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: "Details" }).length).toBeGreaterThan(0)

  cleanup()

  // Verify Reports page only shows permitted report tabs ("Top Sales")
  render(
    <MemoryRouter initialEntries={["/reports"]}>
      <AuthProvider>
        <ReportsPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole("tab", { name: /Top Sales/i })).toBeInTheDocument()
  expect(screen.queryByRole("tab", { name: /Top Customers/i })).not.toBeInTheDocument()
  expect(screen.queryByRole("tab", { name: /All Employees/i })).not.toBeInTheDocument()
})
