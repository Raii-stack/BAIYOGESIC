import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../components/auth/AuthProvider"
import InventoryPage from "./InventoryPage"

const success = (data: object) => new Response(JSON.stringify({ success: true, data }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
})

const admin = { userId: 1, empno: "EMP-1", email: "admin@example.com", role: "administrator", status: "active", mustChangePassword: false }

function product(number: number, unit = "pc", description = `Product ${number}`, unitprice = "12.50") {
  return { prodcode: `PX${String(number).padStart(4, "0")}`, description, unit, unitprice, effdate: "2026-10-01", is_deleted: false, stamp: "ADD admin 2026-10-21 09:00 AM" }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Location() { return <output aria-label="URL">{useLocation().search}</output> }

test("loads real product pages, history, skeletons, and server-side unit filters", async () => {
  let releaseFirstPage: (() => void) | undefined
  const firstPageGate = new Promise<void>((resolve) => { releaseFirstPage = resolve })
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && init?.method === "GET") {
      expect(init.credentials).toBe("include")
      const page = Number(url.searchParams.get("page"))
      const unit = url.searchParams.get("unit")
      if (page === 1 && !unit) await firstPageGate
      const status = url.searchParams.get("status")
      const total = status === "archived" ? 3 : unit ? 7 : 23
      const first = (page - 1) * 10 + 1
      return success({ products: Array.from({ length: Math.max(0, Math.min(10, total - first + 1)) }, (_, index) => ({ ...product(first + index, unit || ["pc", "ea", "mtr"][index % 3]), is_deleted: status === "archived" || (!status && first + index === 3) })), pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) } })
    }
    if (url.pathname === "/api/products/PX0001/prices") return success({ prices: [{ effdate: "2026-10-01", unitprice: "12.50", stamp: "ADD admin" }, { effdate: "2026-01-01", unitprice: "11.00", stamp: "ADD admin" }] })
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText("Loading product records…")).toBeInTheDocument()
  releaseFirstPage?.()

  expect(await screen.findByText("Product 1")).toBeInTheDocument()
  expect(screen.getByText("Showing 1–10 of 23")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /PX0002 Product 2/ })).getByText("ea")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /PX0003 Product 3/ })).getByText("Archived")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit PX0003" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show price history for PX0001" }))
  expect(await screen.findByText("$11.00")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Hide price history for PX0001" })).toHaveAttribute("aria-expanded", "true")

  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Product 11")).toBeInTheDocument()
  expect(screen.getByText("Showing 11–20 of 23")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Page 3" }))
  expect(await screen.findByText("Product 21")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()

  await user.selectOptions(screen.getByLabelText("Unit type"), "ea")
  await waitFor(() => expect(screen.getByText("Showing 1–7 of 7")).toBeInTheDocument())
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("unit=ea"))).toBe(true)
  await user.selectOptions(screen.getByLabelText("Status"), "archived")
  await waitFor(() => expect(screen.getByText("Showing 1–3 of 3")).toBeInTheDocument())
  expect(within(screen.getByRole("table")).getAllByText("Archived")).toHaveLength(3)
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("status=archived"))).toBe(true)
})

test("syncs product sorting and page size with the URL and API", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products") {
      const page = Number(url.searchParams.get("page"))
      const limit = Number(url.searchParams.get("limit"))
      return success({
        products: [product((page - 1) * limit + 1)],
        pagination: { page, limit, total: 80, totalPages: Math.ceil(80 / limit) },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter initialEntries={["/products?page=2&limit=25&sortBy=unitPrice&sortOrder=desc"]}><AuthProvider><InventoryPage /><Location /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText("Product 26")).toBeInTheDocument()
  expect(screen.getByRole("columnheader", { name: /Unit price/ })).toHaveAttribute("aria-sort", "descending")
  expect(screen.getByRole("combobox", { name: "Product rows per page" })).toHaveValue("25")

  await user.click(screen.getByRole("button", { name: /Sort by Unit price/ }))
  await waitFor(() => expect(screen.getByLabelText("URL")).toHaveTextContent("page=1&limit=25&sortBy=unitPrice&sortOrder=asc"))
  expect(screen.getByRole("columnheader", { name: /Unit price/ })).toHaveAttribute("aria-sort", "ascending")

  const pageSize = screen.getByRole("combobox", { name: "Product rows per page" })
  await waitFor(() => expect(pageSize).toBeEnabled())
  await user.selectOptions(pageSize, "50")
  await waitFor(() => expect(screen.getByLabelText("URL")).toHaveTextContent("page=1&limit=50&sortBy=unitPrice&sortOrder=asc"))
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
    const url = new URL(String(input), "http://localhost")
    return url.pathname === "/api/products" && url.searchParams.get("page") === "1"
      && url.searchParams.get("limit") === "50" && url.searchParams.get("sortBy") === "unitPrice"
      && url.searchParams.get("sortOrder") === "asc"
  })).toBe(true))
})

test("waits for a pause in typing before searching products", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products") return success({ products: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Showing 0–0 of 0")
  const search = screen.getByRole("searchbox", { name: "Search products" })
  fireEvent.change(search, { target: { value: "Pr" } })
  fireEvent.change(search, { target: { value: "Prod" } })
  fireEvent.change(search, { target: { value: "Product" } })
  expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/products"))).toHaveLength(1)
  await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/products"))).toHaveLength(2))
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=Product")
})

test("explains filtered empty results and clears every product filter", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products") {
      const filtered = Boolean(url.searchParams.get("search") || url.searchParams.get("unit"))
      return success({
        products: filtered ? [] : [product(1)],
        pagination: { page: 1, limit: 10, total: filtered ? 0 : 1, totalPages: filtered ? 0 : 1 },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  await user.selectOptions(screen.getByLabelText("Unit type"), "ltr")

  expect(await screen.findByText("No products match your filters")).toBeInTheDocument()
  expect(screen.getByText("Clear the search and filters to see the full product list.")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Clear filters" }))

  expect(await screen.findByText("Product 1")).toBeInTheDocument()
  expect(screen.getByLabelText("Unit type")).toHaveValue("")
})

test("creates, updates, and archives a product through the API", async () => {
  let records = [product(1)]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && init?.method === "GET") return success({ products: records, pagination: { page: 1, limit: 10, total: records.length, totalPages: 1 } })
    if (url.pathname === "/api/products" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toEqual({ description: "New product", unit: "pkg", unitprice: 19.99 })
      records = [...records, product(2, "pkg", "New product", "19.99")]
      return success({ product: records[1] })
    }
    if (url.pathname === "/api/products/PX0002" && init?.method === "PUT") {
      expect(JSON.parse(String(init.body))).toEqual({ description: "Updated product", unit: "pkg", unitprice: 21 })
      records = [records[0], { ...product(2, "pkg", "Updated product", "21.00"), effdate: "2026-11-02", stamp: "EDIT admin 2026-11-02" }]
      return success({ product: records[1] })
    }
    if (url.pathname === "/api/products/PX0002" && init?.method === "DELETE") {
      records = records.map((record) => record.prodcode === "PX0002" ? { ...record, is_deleted: true } : record)
      return success({ product: { ...product(2), is_deleted: true } })
    }
    if (url.pathname === "/api/products/PX0002/restore" && init?.method === "POST") {
      records = records.map((record) => record.prodcode === "PX0002" ? { ...record, is_deleted: false } : record)
      return success({ product: { ...product(2), is_deleted: false } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  await user.click(screen.getByRole("button", { name: "Add product" }))
  let dialog = screen.getByRole("dialog", { name: "Add Product" })
  await user.type(within(dialog).getByRole("textbox", { name: /Product Description/ }), "New product")
  await user.selectOptions(within(dialog).getByRole("combobox", { name: /Unit Type/ }), "pkg")
  await user.type(within(dialog).getByRole("spinbutton", { name: /Current Unit Price/ }), "19.99")
  await user.click(within(dialog).getByRole("button", { name: "Create product" }))
  expect(await screen.findByText("New product")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Product created successfully")

  await user.click(screen.getByRole("button", { name: "Edit PX0002" }))
  dialog = screen.getByRole("dialog", { name: "Edit Product" })
  await user.clear(within(dialog).getByRole("textbox", { name: /Product Description/ }))
  await user.type(within(dialog).getByRole("textbox", { name: /Product Description/ }), "Updated product")
  await user.clear(within(dialog).getByRole("spinbutton", { name: /Current Unit Price/ }))
  await user.type(within(dialog).getByRole("spinbutton", { name: /Current Unit Price/ }), "21")
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }))
  expect(await screen.findByText("Updated product")).toBeInTheDocument()
  const updatedRow = screen.getByRole("row", { name: /Updated product/ })
  expect(within(updatedRow).getByText("$21.00")).toBeInTheDocument()
  expect(within(updatedRow).getByText("2026-11-02")).toBeInTheDocument()
  expect(within(updatedRow).getByText("EDIT admin 2026-11-02")).toBeInTheDocument()
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Product updated successfully")
  const getProductCallsAfterEdit = fetchMock.mock.calls.filter(([input, init]) => {
    const url = new URL(String(input), "http://localhost")
    return url.pathname === "/api/products" && (!init?.method || init?.method === "GET")
  })
  expect(getProductCallsAfterEdit).toHaveLength(2)

  await user.click(screen.getByRole("button", { name: "Archive PX0002" }))
  await user.click(screen.getByRole("button", { name: "Archive product" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /Updated product/ })).getByText("Archived")).toBeInTheDocument())
  expect(screen.queryByRole("button", { name: "Archive PX0002" })).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Product archived successfully")
  expect(screen.getByText("Showing 1–2 of 2")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Restore PX0002" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /Updated product/ })).getByText("Active")).toBeInTheDocument())
  expect(screen.getByRole("status")).toHaveTextContent("Product restored successfully")
})

test("shows a clear archive error when a product has active sales", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && init?.method === "GET") return success({ products: [product(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/products/PX0001" && init?.method === "DELETE") return new Response(JSON.stringify({ success: false, error: { message: "Cannot archive product while active sales records exist." } }), { status: 409, headers: { "Content-Type": "application/json" } })
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  const archiveTrigger = screen.getByRole("button", { name: "Archive PX0001" })
  await user.click(archiveTrigger)
  const cancel = screen.getByRole("button", { name: "Cancel" })
  const confirm = screen.getByRole("button", { name: "Archive product" })
  expect(cancel).toHaveFocus()
  await user.tab({ shift: true })
  expect(confirm).toHaveFocus()
  await user.tab()
  expect(cancel).toHaveFocus()
  await user.click(screen.getByRole("button", { name: "Archive product" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("active sales records")
  expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-describedby", "archive-product-description archive-product-error")
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  expect(archiveTrigger).toHaveFocus()
})

test("allows an employee to review products without edit or archive controls", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: { ...admin, role: "employee" } })
    if (url.pathname === "/api/products" && init?.method === "GET") return success({ products: [product(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/products/PX0001/prices") return success({ prices: [{ effdate: "2026-10-01", unitprice: "12.50", stamp: "ADD admin" }] })
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  expect(screen.queryByRole("button", { name: "Add product" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit PX0001" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Archive PX0001" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show price history for PX0001" }))
  expect(await screen.findByText("PX0001", { selector: "p" })).toBeInTheDocument()
})


test("opens PriceHistoryModal from expanded history and allows adding price", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && init?.method === "GET") {
      return success({ products: [product(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    }
    if (url.pathname === "/api/products/PX0001/prices" && init?.method === "GET") {
      return success({
        prices: [
          { effdate: "2026-10-01", unitprice: "12.50", stamp: "ADD admin 2026-10-01" },
          { effdate: "2026-01-01", unitprice: "10.00", stamp: "ADD admin 2026-01-01" },
        ],
      })
    }
    if (url.pathname === "/api/products/PX0001/price-history" && init?.method === "POST") {
      const body = JSON.parse(String(init.body))
      expect(body.effdate).toBeDefined()
      expect(body.price).toBe(15)
      return success({ price: { effdate: body.effdate, unitprice: 15 } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")

  expect(screen.queryByRole("button", { name: "Prices for PX0001" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show price history for PX0001" }))
  await user.click(screen.getByRole("button", { name: "Manage prices" }))

  // Modal appears with header
  const modal = await screen.findByRole("dialog", { name: /Price History/i })
  expect(within(modal).getByText("Price History — PX0001")).toBeInTheDocument()
  expect(within(modal).getByText(/Unit:/)).toHaveTextContent("Unit: pc")
  expect(within(modal).getByText("$12.50")).toBeInTheDocument()
  expect(within(modal).getByText("$10.00")).toBeInTheDocument()
  expect(within(modal).getByText("Current")).toBeInTheDocument()

  // Admin view shows Status and Stamp headers
  expect(within(modal).getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
  expect(within(modal).getByRole("columnheader", { name: "Stamp" })).toBeInTheDocument()

  // Authorized user opens the add-price form.
  await user.click(within(modal).getByRole("button", { name: "Add Price" }))
  expect(within(modal).getByText("New Price Tier")).toBeInTheDocument()

  // Enter price and submit
  const priceInput = within(modal).getByPlaceholderText("0.00")
  await user.type(priceInput, "15.00")
  await user.click(within(modal).getByRole("button", { name: "Save Price" }))

  // Verify modal made POST request
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/products/PX0001/price-history"),
      expect.objectContaining({ method: "POST" })
    )
  })

  // Close modal with Escape
  await user.keyboard("{Escape}")
  await waitFor(() => {
    expect(screen.queryByText("Price History — PX0001")).not.toBeInTheDocument()
  })
})

test("hides Status and Stamp in PriceHistoryModal for standard user", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: { ...admin, role: "employee" } })
    if (url.pathname === "/api/products" && init?.method === "GET") {
      return success({ products: [product(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    }
    if (url.pathname === "/api/products/PX0001/prices" && init?.method === "GET") {
      return success({
        prices: [{ effdate: "2026-10-01", unitprice: "12.50", stamp: "ADD admin" }],
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/inventory?notificationProduct=PX0001"]}><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByRole("cell", { name: "Product 1" })

  expect(screen.queryByRole("button", { name: "Prices for PX0001" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Manage prices" })).not.toBeInTheDocument()
  expect(await screen.findByText("Price History — PX0001")).toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Stamp" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "+ Add Price" })).not.toBeInTheDocument()
})
