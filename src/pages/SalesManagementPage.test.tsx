import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { AuthProvider } from "../components/auth/AuthProvider"
import SalesManagementPage from "./SalesManagementPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function Location() { return <output aria-label="URL">{useLocation().search}</output> }
function renderSales(query: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { user: {
    userId: "1", email: "preview@hope.inc", role: "superadmin", status: "active", mustChangePassword: false,
  } } }), { headers: { "Content-Type": "application/json" } })))
  render(<MemoryRouter initialEntries={["/sales?view=transactions&" + query]}><AuthProvider><SalesManagementPage /><Location /></AuthProvider></MemoryRouter>)
}

test("clamps a stale page query while keeping the sale search and query-bearing create link", async () => {
  renderSales("page=999&search=T-001")
  expect(await screen.findByText("T-001")).toBeInTheDocument()
  expect(screen.getByLabelText("URL")).toHaveTextContent("view=transactions&page=1&search=T-001")
  expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Create sale" })).toHaveAttribute("href", "/sales/new?view=create")
})

test("empty sales searches and archived views show the appropriate actions", async () => {
  const user = userEvent.setup()
  renderSales("page=1&search=no-match")
  expect(await screen.findByText("No sales match this view.")).toBeInTheDocument()
  expect(screen.getByText("Showing 0–0 of 0")).toBeInTheDocument()
  await user.clear(screen.getByRole("searchbox", { name: "Search sales" }))
  await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "Inactive")
  const table = within(screen.getByRole("table"))
  expect(table.getAllByRole("button", { name: "Restore" })).toHaveLength(2)
  expect(table.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()
  expect(table.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
})

test("recording a preview payment updates the balance without render warnings", async () => {
  const user = userEvent.setup()
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  renderSales("page=1&search=T-001")
  await user.click(await screen.findByRole("button", { name: "Details", exact: true }))
  const details = within(screen.getByRole("dialog", { name: /Sale Details/ }))
  await user.click(details.getByRole("button", { name: "Record Payment", exact: true }))
  const payment = within(screen.getByRole("dialog", { name: "Record Payment", exact: true }))
  await user.clear(payment.getByRole("spinbutton"))
  await user.type(payment.getByRole("spinbutton"), "10")
  await user.click(payment.getByRole("button", { name: "Save Payment", exact: true }))
  expect(await details.findByText("$24.50", { exact: true })).toBeInTheDocument()
  expect(screen.queryByRole("dialog", { name: "Record Payment", exact: true })).not.toBeInTheDocument()
  expect(errors).not.toHaveBeenCalled()
})
