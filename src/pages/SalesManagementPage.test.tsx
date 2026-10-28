import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { AuthProvider } from "../components/auth/AuthProvider"
import CreateSalePage from "./CreateSalePage"
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

test("CreateSalePage calculates line totals with price-as-of-date lookup and submits to /api/sales", async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/api/sales") && init?.method === "POST") {
      const body = JSON.parse(String(init.body || "{}"))
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            sale: {
              transno: "TR000125",
              salesdate: body.salesdate,
              custno: body.custno,
              custname: "Northstar Office Group",
              empno: body.empno,
              empname: "Employee Record 01",
              is_deleted: false,
              stamp: "ADD system",
              lines: body.lines,
              payments: [],
            },
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            userId: "1",
            email: "preview@hope.inc",
            role: "superadmin",
            status: "active",
            mustChangePassword: false,
          },
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  })
  vi.stubGlobal("fetch", fetchMock)

  render(
    <MemoryRouter initialEntries={["/sales/new?view=create"]}>
      <AuthProvider>
        <Routes>
          <Route path="/sales/new" element={<CreateSalePage />} />
          <Route path="/sales" element={<div>Sales list destination</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole("heading", { name: "Create sale" })).toBeInTheDocument()

  // Select Customer and Employee
  const comboboxes = screen.getAllByRole("combobox")
  await user.click(comboboxes[0])
  await user.click(screen.getByRole("option", { name: /Northstar Office Group/i }))
  await user.click(comboboxes[1])
  await user.click(screen.getByRole("option", { name: /Employee Record 01/i }))

  // Update quantity to 0 and verify validation error
  const qtyInput = screen.getByLabelText("Quantity 1")
  await user.clear(qtyInput)
  await user.type(qtyInput, "0")
  await user.click(screen.getByRole("button", { name: "Save sale" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(/Quantity must be greater than zero/i)

  // Set quantity to 4 (P-001 @ $13.75 = $55.00) and submit
  await user.clear(qtyInput)
  await user.type(qtyInput, "4")
  expect(screen.getAllByText("$55.00").length).toBeGreaterThan(0)

  await user.click(screen.getByRole("button", { name: "Save sale" }))
  expect(await screen.findByText("Sales list destination")).toBeInTheDocument()
})
