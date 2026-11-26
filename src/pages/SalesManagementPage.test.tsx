import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { AuthProvider } from "../components/auth/AuthProvider"
import CreateSalePage from "./CreateSalePage"
import SalesManagementPage from "./SalesManagementPage"
import { salesApi, toSaleTransaction } from "../lib/sales-api"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function Location() { return <output aria-label="URL">{useLocation().search}</output> }
function renderSales(query: string) {
  const user = {
    userId: "1", email: "preview@hope.inc", role: "superadmin", status: "active", mustChangePassword: false,
  }
  const records = [false, true, true].map((archived, index) => ({ transno: `T-00${index + 1}`, custno: "C-001", custname: "Acme", empno: "00001", empname: "Alex", salesdate: "2026-10-01", is_deleted: archived, lines: [], payments: [] }))
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    let data: object = { user }
    if (url.pathname === "/api/sales") {
      const selected = records.filter((sale) => (!url.searchParams.get("search") || sale.transno.includes(url.searchParams.get("search")!)) && (url.searchParams.get("status") === "archived" ? sale.is_deleted : !sale.is_deleted))
      const page = Number(url.searchParams.get("page"))
      data = { sales: selected.slice((page - 1) * 10, page * 10), pagination: { page, limit: 10, total: selected.length, totalPages: Math.ceil(selected.length / 10) } }
    }
    return new Response(JSON.stringify({ success: true, data }), { headers: { "Content-Type": "application/json" } })
  }))
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
  expect(await table.findAllByRole("button", { name: /Restore/ })).toHaveLength(2)
  expect(table.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument()
  expect(table.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
})

test("loads server pages beyond 200 records and navigates with server totals", async () => {
  const list = vi.spyOn(salesApi, "list").mockImplementation(async (options = {}) => {
    const page = options.page || 1
    return { sales: Array.from({ length: 10 }, (_, index) => toSaleTransaction({ transno: `REAL-${(page - 1) * 10 + index + 1}`, lines: [], payments: [] })), pagination: { page, limit: 10, total: 235, totalPages: 24 } }
  })
  renderSales("page=21")
  expect(await screen.findByText("REAL-201")).toBeInTheDocument()
  expect(screen.getByText("Showing 201–210 of 235")).toBeInTheDocument()
  expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 21, limit: 10, status: "active" }), expect.any(AbortSignal))
  await userEvent.setup().click(screen.getByRole("button", { name: "Next", exact: true }))
  expect(await screen.findByText("REAL-211")).toBeInTheDocument()
  expect(screen.getByLabelText("URL")).toHaveTextContent("page=22")
})

test("shows a failed sales request without demo records and supports retry", async () => {
  vi.spyOn(salesApi, "list").mockRejectedValueOnce(new Error("The service is temporarily unavailable."))
    .mockResolvedValueOnce({ sales: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })
  renderSales("page=1")
  expect(await screen.findByRole("alert")).toHaveTextContent("The service is temporarily unavailable.")
  expect(screen.queryByText("T-001")).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByText("No sales match this view.")).toBeInTheDocument()
})

test("records the selected payment method through the API before updating the balance", async () => {
  const user = userEvent.setup()
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  const sale = (transno: string, payments: object[]) => ({
    transno,
    salesdate: "2026-10-01",
    custno: "C-001",
    custname: "Acme Corporation",
    empno: "E-002",
    empname: "Juan Reyes",
    is_deleted: false,
    lines: [
      { id: "SD-001", prodcode: "P-001", description: "Industrial Widget A", quantity: 10, unitprice: 13.75, is_deleted: false },
      { id: "SD-002", prodcode: "P-002", description: "Service Component B", quantity: 5, unitprice: 19.4, is_deleted: false },
    ],
    payments,
  })
  const existingPayments = [
    { orno: "OR-10001", paydate: "2026-10-01", amount: 150, payment_method: "Cash" },
    { orno: "OR-10008", paydate: "2026-10-03", amount: 50, payment_method: "Check" },
  ]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return new Response(JSON.stringify({ success: true, data: { user: {
      userId: "1", email: "preview@hope.inc", role: "superadmin", status: "active", mustChangePassword: false,
    } } }), { headers: { "Content-Type": "application/json" } })
    if (url.pathname === "/api/sales" && init?.method === "GET") return new Response(JSON.stringify({ success: true, data: { sales: [sale("T-001", existingPayments), sale("T-002", [{ orno: "OR-20001", paydate: "2026-10-02", amount: 234.5, payment_method: "Cash" }])], pagination: { page: 1, limit: 200, total: 2, totalPages: 1 } } }), { headers: { "Content-Type": "application/json" } })
    if (url.pathname === "/api/sales/T-001/payments" && init?.method === "POST") {
      const body = JSON.parse(String(init.body))
      expect(body).toEqual(expect.objectContaining({ amount: 10, payment_method: "Bank Transfer" }))
      return new Response(JSON.stringify({ success: true, data: { sale: sale("T-001", [...existingPayments, { orno: "OR-10009", paydate: body.paydate, amount: body.amount, payment_method: body.payment_method }]) } }), { status: 201, headers: { "Content-Type": "application/json" } })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/sales?view=transactions&page=1&search=T-001"]}><AuthProvider><SalesManagementPage /></AuthProvider></MemoryRouter>)
  expect(await screen.findByRole("button", { name: "Record payment for T-002", exact: true })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Record payment for T-001", exact: true }))
  const payment = within(screen.getByRole("dialog", { name: "Record Payment", exact: true }))
  expect(payment.getByText("Sales order T-001")).toBeInTheDocument()
  await user.clear(payment.getByRole("spinbutton"))
  await user.type(payment.getByRole("spinbutton"), "10")
  await user.selectOptions(payment.getByRole("combobox", { name: "Payment method" }), "Bank Transfer")
  await user.click(payment.getByRole("button", { name: "Save Payment", exact: true }))
  expect(await screen.findByText("$24.50", { exact: true })).toBeInTheDocument()
  expect(screen.queryByRole("dialog", { name: "Record Payment", exact: true })).not.toBeInTheDocument()
  expect(screen.queryByRole("dialog", { name: /Sale Details/ })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/api/sales/T-001/payments") && init?.method === "POST")).toBe(true)

  await user.click(screen.getByRole("button", { name: "Details for T-001", exact: true }))
  const details = within(screen.getByRole("dialog", { name: /Sale Details/ }))
  expect(details.queryByRole("button", { name: "Record Payment", exact: true })).not.toBeInTheDocument()
  expect(details.getByText("Bank Transfer")).toBeInTheDocument()
  expect(details.getByText("$24.50", { exact: true })).toBeInTheDocument()
  expect(errors).not.toHaveBeenCalled()
})

test("CreateSalePage calculates line totals with price-as-of-date lookup and submits to /api/sales", async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/api/sales") && init?.method === "POST") {
      const body = JSON.parse(String(init.body || "{}"))
      expect(body.empno).toBe("00002")
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            sale: {
              transno: "SO-202610-0099",
              custno: body.custno,
              empno: body.empno,
              salesdate: body.salesdate,
              status: "Active",
              lines: body.lines,
              payments: [],
            },
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      )
    }
    if (url.includes("/api/sales/catalog")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            customers: [{ custno: "C0001", custname: "Northstar Office Group", payterm: "30D" }],
            employees: [
              { empno: "00001", firstname: "Employee", lastname: "Record 01" },
              { empno: "00002", firstname: "Employee", lastname: "Record 02" },
            ],
            products: [{ prodcode: "P-001", description: "Industrial Widget A", unit: "pc", unitprice: 13.75, priceHistory: [] }],
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    if (url.includes("/api/sales/price-lookup")) {
      return new Response(
        JSON.stringify({ success: true, data: { unitPrice: 13.75, effectiveDate: "2026-10-01" } }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            userId: "1",
            empno: "00001",
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

  // The logged-in employee is selected by default and remains changeable.
  const comboboxes = screen.getAllByRole("combobox")
  const salesperson = screen.getByPlaceholderText("Search salesperson name or ID")
  expect(await screen.findByDisplayValue("Employee Record 01")).toBe(salesperson)
  await user.click(comboboxes[0])
  await user.click(screen.getByRole("option", { name: /Northstar Office Group/i }))
  await user.clear(salesperson)
  await user.click(screen.getByRole("option", { name: /Employee Record 02/i }))
  expect(salesperson).toHaveValue("Employee Record 02")

  // No items are selected by default.
  expect(screen.getByText(/No items added yet/i)).toBeInTheDocument()
  expect(screen.queryByLabelText("Product 1")).not.toBeInTheDocument()

  // Submitting with zero items shows validation and does not open confirmation.
  await user.click(screen.getByRole("button", { name: "Save sale" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(/Add at least one line item/i)
  expect(screen.queryByRole("dialog", { name: "Confirm sales order" })).not.toBeInTheDocument()

  // Add item and select P-001, then update quantity to 0 and verify validation error
  await user.click(screen.getByRole("button", { name: "Add item" }))
  await user.selectOptions(screen.getByRole("combobox", { name: "Product 1" }), "P-001")
  const qtyInput = screen.getByLabelText("Quantity 1")
  await user.clear(qtyInput)
  await user.type(qtyInput, "0")
  await user.click(screen.getByRole("button", { name: "Save sale" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(/Quantity must be greater than zero/i)
  expect(screen.queryByRole("dialog", { name: "Confirm sales order" })).not.toBeInTheDocument()

  // Set quantity to 4 (P-001 @ $13.75 = $55.00), open confirmation modal, and confirm
  await user.clear(qtyInput)
  await user.type(qtyInput, "4")
  expect(screen.getAllByText("$55.00").length).toBeGreaterThan(0)

  await user.click(screen.getByRole("button", { name: "Save sale" }))
  const confirmDialog = within(screen.getByRole("dialog", { name: "Confirm sales order" }))
  expect(confirmDialog.getByText("Northstar Office Group")).toBeInTheDocument()
  expect(confirmDialog.getByText("Employee Record 02")).toBeInTheDocument()
  expect(confirmDialog.getByText("P-001")).toBeInTheDocument()
  expect(confirmDialog.getByText("Industrial Widget A")).toBeInTheDocument()
  expect(confirmDialog.getAllByText("$55.00").length).toBeGreaterThan(0)

  await user.click(confirmDialog.getByRole("button", { name: "Confirm & save sale" }))
  expect(await screen.findByText("Sales list destination")).toBeInTheDocument()
})

test("opens ArchiveSaleModal, allows cancelling, and confirms archiving via the API", async () => {
  const user = userEvent.setup()
  const sale = {
    transno: "SO-202610-0001",
    salesdate: "2026-10-01",
    custno: "C-001",
    custname: "Acme Corporation",
    empno: "E-002",
    empname: "Juan Reyes",
    is_deleted: false,
    lines: [],
    payments: [],
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") {
      return new Response(JSON.stringify({ success: true, data: { user: {
        userId: "1", email: "admin@hope.inc", role: "admin", status: "active", mustChangePassword: false,
      } } }), { headers: { "Content-Type": "application/json" } })
    }
    if (url.pathname === "/api/sales" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: { sales: [sale], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } }), { headers: { "Content-Type": "application/json" } })
    }
    if (url.pathname === "/api/sales/SO-202610-0001" && init?.method === "DELETE") {
      return new Response(JSON.stringify({ success: true, data: { sale: { ...sale, is_deleted: true } } }), { headers: { "Content-Type": "application/json" } })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)

  render(
    <MemoryRouter initialEntries={["/sales?view=transactions"]}>
      <AuthProvider>
        <SalesManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("SO-202610-0001")).toBeInTheDocument()

  // Click Archive button in table
  await user.click(screen.getByRole("button", { name: "Archive SO-202610-0001" }))

  // Verify modal is shown
  const dialog = screen.getByRole("alertdialog", { name: "Archive this sales order?" })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByText("SO-202610-0001")).toBeInTheDocument()

  // Cancel dismissal
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

  // Open again and confirm
  await user.click(screen.getByRole("button", { name: "Archive SO-202610-0001" }))
  const confirmDialog = screen.getByRole("alertdialog", { name: "Archive this sales order?" })
  await user.click(within(confirmDialog).getByRole("button", { name: "Archive sale" }))

  // Modal closes and delete API was invoked
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/api/sales/SO-202610-0001") && init?.method === "DELETE")).toBe(true)
})

test("shows 409 Conflict error in ArchiveSaleModal when sale has recorded payments", async () => {
  const user = userEvent.setup()
  const sale = {
    transno: "SO-202610-0002",
    salesdate: "2026-10-01",
    custno: "C-001",
    custname: "Acme Corporation",
    empno: "E-002",
    empname: "Juan Reyes",
    is_deleted: false,
    lines: [],
    payments: [{ orno: "OR-001", amount: 50, paydate: "2026-10-02" }],
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") {
      return new Response(JSON.stringify({ success: true, data: { user: {
        userId: "1", email: "admin@hope.inc", role: "admin", status: "active", mustChangePassword: false,
      } } }), { headers: { "Content-Type": "application/json" } })
    }
    if (url.pathname === "/api/sales" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: { sales: [sale], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } }), { headers: { "Content-Type": "application/json" } })
    }
    if (url.pathname === "/api/sales/SO-202610-0002" && init?.method === "DELETE") {
      return new Response(
        JSON.stringify({ success: false, error: { message: "Cannot archive a sales order that already has recorded payments.", statusCode: 409 } }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      )
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)

  render(
    <MemoryRouter initialEntries={["/sales?view=transactions"]}>
      <AuthProvider>
        <SalesManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("SO-202610-0002")).toBeInTheDocument()

  // Click Archive button
  await user.click(screen.getByRole("button", { name: "Archive SO-202610-0002" }))
  const dialog = screen.getByRole("alertdialog", { name: "Archive this sales order?" })
  await user.click(within(dialog).getByRole("button", { name: "Archive sale" }))

  // Error is displayed inside the modal alertdialog
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cannot archive a sales order that already has recorded payments.")
  expect(dialog).toBeInTheDocument()
})

test("restores an archived sales order via the API", async () => {
  const user = userEvent.setup()
  const sale = {
    transno: "SO-202610-0003",
    salesdate: "2026-10-01",
    custno: "C-001",
    custname: "Acme Corporation",
    empno: "E-002",
    empname: "Juan Reyes",
    is_deleted: true,
    lines: [],
    payments: [],
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") {
      return new Response(JSON.stringify({ success: true, data: { user: {
        userId: "1", email: "admin@hope.inc", role: "admin", status: "active", mustChangePassword: false,
      } } }), { headers: { "Content-Type": "application/json" } })
    }
    if (url.pathname === "/api/sales" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: { sales: [sale], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } }), { headers: { "Content-Type": "application/json" } })
    }
    if (url.pathname === "/api/sales/SO-202610-0003/restore" && (init?.method === "PATCH" || init?.method === "POST")) {
      return new Response(JSON.stringify({ success: true, data: { sale: { ...sale, is_deleted: false } } }), { headers: { "Content-Type": "application/json" } })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)

  render(
    <MemoryRouter initialEntries={["/sales?view=transactions"]}>
      <AuthProvider>
        <SalesManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  // Switch to Archived view
  await user.selectOptions(await screen.findByRole("combobox", { name: "Status" }), "Inactive")
  expect(await screen.findByText("SO-202610-0003")).toBeInTheDocument()

  // Click Restore button
  await user.click(screen.getByRole("button", { name: "Restore SO-202610-0003" }))

  expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/api/sales/SO-202610-0003/restore"))).toBe(true)
})

test("CreateSalePage supports quick-add product search, incrementing quantities, and adding focused rows from the bottom", async () => {
  const user = userEvent.setup()
  let submittedLines: unknown = null
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/api/sales") && init?.method === "POST") {
      const body = JSON.parse(String(init.body || "{}"))
      submittedLines = body.lines
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            sale: {
              transno: "SO-202610-0100",
              custno: body.custno,
              empno: body.empno,
              salesdate: body.salesdate,
              status: "Active",
              lines: body.lines,
              payments: [],
            },
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      )
    }
    if (url.includes("/api/sales/catalog")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            customers: [{ custno: "C0001", custname: "Northstar Office Group", payterm: "30D" }],
            employees: [{ empno: "00001", firstname: "Employee", lastname: "Record 01" }],
            products: [
              { prodcode: "P-001", description: "Industrial Widget A", unit: "pc", unitprice: 10, priceHistory: [] },
              { prodcode: "P-002", description: "Copper Valve B", unit: "ea", unitprice: 25, priceHistory: [] },
              { prodcode: "P-003", description: "Steel Gasket C", unit: "pkg", unitprice: 15, priceHistory: [] },
            ],
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    if (url.includes("/api/sales/price-lookup")) {
      const parsed = new URL(url, "http://localhost")
      const prodcode = parsed.searchParams.get("prodcode")
      const price = prodcode === "P-002" ? 25 : prodcode === "P-003" ? 15 : 10
      return new Response(
        JSON.stringify({ success: true, data: { unitPrice: price, effectiveDate: "2026-10-01" } }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            userId: "1",
            empno: "00001",
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
  expect(screen.getByText(/No items added yet/i)).toBeInTheDocument()
  const customerInput = screen.getByPlaceholderText("Search by customer name or ID")
  await user.click(customerInput)
  await user.click(screen.getByRole("option", { name: /Northstar Office Group/i }))

  // Quick-add P-001 and P-002 by searching, then increment P-002
  const quickSearch = screen.getByRole("combobox", { name: /Search and add product/i })
  await user.type(quickSearch, "Widget")
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /P-001 — Industrial Widget A/i }))
  await user.type(quickSearch, "Copper")
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /P-002 — Copper Valve B/i }))
  expect(screen.getByRole("combobox", { name: "Product 2" })).toHaveValue("P-002")
  expect(screen.getByText(/Added Copper Valve B \(P-002\)\./)).toBeInTheDocument()

  await user.type(quickSearch, "P-002")
  const quickOption = within(screen.getByRole("listbox")).getByRole("option", { name: /P-002 — Copper Valve B/i })
  expect(quickOption).toHaveTextContent("In list · +1")
  await user.click(quickOption)
  expect(screen.getByLabelText("Quantity 2")).toHaveValue(2)
  expect(screen.getByText(/Increased Copper Valve B \(P-002\) quantity to 2\./)).toBeInTheDocument()

  // Clicking X removes P-001 from the list; clearing the product dropdown removes the remaining item too
  await user.click(screen.getByRole("button", { name: "Remove line item 1" }))
  expect(screen.getByRole("combobox", { name: "Product 1" })).toHaveValue("P-002")
  expect(screen.queryByRole("combobox", { name: "Product 2" })).not.toBeInTheDocument()
  await user.selectOptions(screen.getByRole("combobox", { name: "Product 1" }), "")
  expect(screen.getByText(/No items added yet/i)).toBeInTheDocument()

  // Re-add P-001 and P-002 (qty 2) via Quick add, then add P-003 via bottom button dropdown
  await user.type(quickSearch, "P-001")
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /P-001 — Industrial Widget A/i }))
  await user.type(quickSearch, "P-002")
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /P-002 — Copper Valve B/i }))
  await user.type(quickSearch, "P-002")
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /P-002 — Copper Valve B/i }))

  await user.click(screen.getByRole("button", { name: "Add another item" }))
  const product3Select = screen.getByRole("combobox", { name: "Product 3" })
  expect(product3Select).toHaveFocus()
  expect(within(product3Select).getByRole("option", { name: /P-001 — Industrial Widget A/i })).toBeDisabled()
  expect(within(product3Select).getByRole("option", { name: /P-002 — Copper Valve B/i })).toBeDisabled()
  await user.selectOptions(product3Select, "P-003")
  expect(product3Select).toHaveValue("P-003")

  await user.click(screen.getByRole("button", { name: "Save sale" }))
  const confirmDialog = within(screen.getByRole("dialog", { name: "Confirm sales order" }))
  expect(confirmDialog.getByText("Industrial Widget A")).toBeInTheDocument()
  expect(confirmDialog.getByText("Copper Valve B")).toBeInTheDocument()
  expect(confirmDialog.getByText("Steel Gasket C")).toBeInTheDocument()
  await user.click(confirmDialog.getByRole("button", { name: "Confirm & save sale" }))
  expect(await screen.findByText("Sales list destination")).toBeInTheDocument()
  expect(submittedLines).toEqual([
    { prodcode: "P-001", quantity: 1, unitprice: 10 },
    { prodcode: "P-002", quantity: 2, unitprice: 25 },
    { prodcode: "P-003", quantity: 1, unitprice: 15 },
  ])
})
