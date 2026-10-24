import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../components/auth/AuthProvider"
import DashboardLayout from "./DashboardLayout"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function SalesDestination() {
  const [params] = useSearchParams()
  const location = useLocation()
  return <DashboardLayout><div>Sales records</div><input type="search" aria-label="Page search" defaultValue={params.get("search") || ""} /><output aria-label="Destination URL">{location.search}</output></DashboardLayout>
}

function renderWorkspace(path: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { user: {
    userId: "user-1", empno: "00010", name: "Agent One", email: "agent@hope.inc", role: "administrator", status: "active", mustChangePassword: false,
  } } }), { status: 200, headers: { "Content-Type": "application/json" } })))

  render(<MemoryRouter initialEntries={[path]}><AuthProvider><Routes>
    <Route path="/sales/new" element={<DashboardLayout><div>Create a sale</div></DashboardLayout>} />
    <Route path="/sales" element={<SalesDestination />} />
    <Route path="/employees/:employeeId" element={<DashboardLayout><div>Employee record</div></DashboardLayout>} />
    <Route path="/employees" element={<DashboardLayout><div>Employee records</div></DashboardLayout>} />
    <Route path="/dashboard" element={<DashboardLayout><div>Home workspace</div></DashboardLayout>} />
    <Route path="/profile" element={<DashboardLayout><div>Account details</div></DashboardLayout>} />
  </Routes></AuthProvider></MemoryRouter>)
}

test.each([
  ["/sales/new", "Sales", "/sales?view=transactions&page=1", "Create sale", "Sales records"],
  ["/employees/00010", "Employees", "/employees?view=employees&page=1", "Employee details", "Employee records"],
])("nested breadcrumbs return to the right parent from %s", async (path, parent, href, current, destination) => {
  renderWorkspace(path)
  await screen.findByRole("link", { name: /Agent One/ })
  const breadcrumb = within(screen.getByRole("navigation", { name: "Breadcrumb" }))
  expect(breadcrumb.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/dashboard?view=overview")
  expect(breadcrumb.getByText(current)).toHaveAttribute("aria-current", "page")
  const parentLink = breadcrumb.getByRole("link", { name: parent })
  expect(parentLink).toHaveAttribute("href", href)
  await userEvent.setup().click(parentLink)
  expect(await screen.findByText(destination)).toBeInTheDocument()
})

test("account menu closes with Escape and links to the account", async () => {
  renderWorkspace("/dashboard")
  await screen.findByRole("link", { name: /Agent One/ })
  const user = userEvent.setup()
  const summary = screen.getByLabelText("Account menu")
  await user.click(summary)
  expect(summary.closest("details")).toHaveAttribute("open")
  expect(screen.getByRole("link", { name: "My account", exact: true })).toHaveAttribute("href", "/profile?view=account")
  await user.keyboard("{Escape}")
  expect(summary.closest("details")).not.toHaveAttribute("open")
  expect(summary).toHaveFocus()
  await user.click(summary)
  await user.click(screen.getByRole("link", { name: "My account", exact: true }))
  expect(await screen.findByText("Account details")).toBeInTheDocument()
})

test("mobile navigation restores page scrolling when resized to desktop", async () => {
  renderWorkspace("/dashboard")
  await screen.findByRole("link", { name: /Agent One/ })
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Open navigation" }))
  expect(document.body.style.overflow).toBe("hidden")
  fireEvent(window, new Event("resize"))
  expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false")
  expect(document.body.style.overflow).toBe("")
})

test.each(["click", "enter"])("sidebar search opens modules without copying its query using %s", async (method) => {
  renderWorkspace("/dashboard")
  await screen.findByRole("link", { name: /Agent One/ })
  const user = userEvent.setup()
  const search = screen.getByRole("searchbox", { name: "Search workspace" })
  await user.type(search, "sales")
  const result = screen.getByRole("option", { name: /^Sales/ })
  expect(result).toHaveAttribute("href", "/sales?view=transactions&page=1")
  if (method === "click") await user.click(result)
  else await user.keyboard("{Enter}")
  expect(await screen.findByText("Sales records")).toBeInTheDocument()
  expect(screen.getByLabelText("Page search")).toHaveValue("")
  expect(screen.getByLabelText("Destination URL")).toHaveTextContent("?view=transactions&page=1")
  expect(screen.getByLabelText("Destination URL")).not.toHaveTextContent("search=")
  expect(screen.getByRole("searchbox", { name: "Search workspace" })).toHaveValue("")
})
