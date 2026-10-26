import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { AuthProvider } from "../components/auth/AuthProvider"
import ReportsPage from "./ReportsPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Location() { return <output aria-label="URL">{useLocation().search}</output> }
function renderReports(query: string, rights?: string[]) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { user: {
    userId: "1", email: "preview@hope.inc", role: rights ? "employee" : "superadmin",
    status: "active", mustChangePassword: false, rights,
  } } }), { headers: { "Content-Type": "application/json" } })))
  render(<MemoryRouter initialEntries={["/reports?view=reports&" + query]}><AuthProvider><ReportsPage /><Location /></AuthProvider></MemoryRouter>)
}

test("report tabs update the URL and only one print action is shown", async () => {
  const user = userEvent.setup()
  const print = vi.spyOn(window, "print").mockImplementation(() => {})
  renderReports("report=Top+Sales&custom=keep")
  expect(await screen.findByRole("tab", { name: "Top Sales" })).toHaveAttribute("aria-selected", "true")
  await user.click(screen.getByRole("tab", { name: "Product Master List" }))
  expect(screen.getByLabelText("URL")).toHaveTextContent("report=Product+Master+List&custom=keep")
  expect(screen.getByRole("heading", { name: "Product Master List" })).toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Print / save PDF" }))
  expect(print).toHaveBeenCalledOnce()
  print.mockRestore()
})

test("unauthorized report queries fall back safely and result limits stay valid", async () => {
  renderReports("report=All+Employees", ["reports.access", "reports.top-sales"])
  expect(await screen.findByRole("tab", { name: "Top Sales" })).toHaveAttribute("aria-selected", "true")
  expect(screen.queryByRole("tab", { name: "All Employees" })).not.toBeInTheDocument()
  const limit = screen.getByRole("spinbutton", { name: "Number of results" })
  fireEvent.change(limit, { target: { value: "1" } })
  expect(screen.getAllByRole("row")).toHaveLength(2)
  fireEvent.change(limit, { target: { value: "-5" } })
  expect(limit).toHaveValue(1)
  fireEvent.change(limit, { target: { value: "500" } })
  expect(limit).toHaveValue(100)
})

test("report tabs support arrow keys, Home, and End without a dropdown", async () => {
  const user = userEvent.setup()
  renderReports("report=Top+Sales")
  const sales = await screen.findByRole("tab", { name: "Top Sales" })
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  await user.click(sales)
  await user.keyboard("{ArrowRight}")
  const customers = screen.getByRole("tab", { name: "Top Customers" })
  expect(customers).toHaveFocus()
  expect(customers).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Top Customers")
  await user.keyboard("{End}")
  expect(sales).toHaveFocus()
  await user.keyboard("{ArrowLeft}")
  expect(screen.getByRole("tab", { name: "Employee Job History" })).toHaveFocus()
  await user.keyboard("{Home}")
  expect(customers).toHaveFocus()
  expect(screen.getByLabelText("URL")).toHaveTextContent("report=Top+Customers")
})
