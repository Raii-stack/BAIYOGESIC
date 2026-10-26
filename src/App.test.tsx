import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

test("filters dashboard tiles, sidebar links, sales actions, and report choices based on user rights", async () => {
  const scopedEmployee = {
    userId: "emp-1",
    empno: "00010",
    firstName: "Agent",
    lastName: "One",
    name: "Agent One",
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
          <Route path="/sales" element={<div>Sales search opened</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole("heading", { name: "Welcome back, Agent One" })).toBeInTheDocument()
  // Permitted modules are shown
  expect(screen.getAllByText("Sales").length).toBeGreaterThan(0)
  expect(screen.getAllByText("Reports").length).toBeGreaterThan(0)
  // Unpermitted modules are hidden from sidebar and tiles
  expect(screen.queryByText("Customers")).not.toBeInTheDocument()
  expect(screen.queryByText("Products")).not.toBeInTheDocument()
  expect(screen.queryByText("Employees")).not.toBeInTheDocument()
  expect(screen.queryByText("Users")).not.toBeInTheDocument()
  expect(screen.getAllByRole("link", { name: /Agent One/ }).length).toBeGreaterThan(0)
  expect(screen.getAllByRole("link", { name: /Agent One/ })[0]).toHaveAttribute("href", "/profile?view=account")
  expect(screen.getByRole("link", { name: "Sales" })).toHaveAttribute("href", "/sales?view=transactions&page=1")
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")
  expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Home")).toHaveAttribute("aria-current", "page")
  expect(screen.queryByText("View my profile")).not.toBeInTheDocument()

  const user = userEvent.setup()
  const search = screen.getByRole("searchbox", { name: "Search workspace" })
  await user.type(search, "customers")
  expect(screen.queryByRole("option")).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("No matching modules")
  await user.keyboard("{Escape}")
  expect(search).toHaveValue("")
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  await user.type(search, "sales")
  const salesResult = screen.getByRole("option", { name: /Sales/ })
  expect(salesResult).toHaveAttribute("href", "/sales?view=transactions&page=1")
  await user.keyboard("{Enter}")
  expect(await screen.findByText("Sales search opened")).toBeInTheDocument()

  cleanup()

  // Verify Sales page hides restricted actions and audit columns.
  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <AuthProvider>
        <SalesManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole("heading", { name: "Sales" })).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Create sale" })).not.toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Stamp" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: "Details" }).length).toBeGreaterThan(0)

  cleanup()

  // Verify Reports page only shows permitted report choices ("Top Sales")
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
