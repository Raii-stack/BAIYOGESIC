import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
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
      records = [records[0], product(2, "pkg", "Updated product", "21.00")]
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
  expect(screen.getByRole("status")).toHaveTextContent("Product updated successfully")

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
  await user.click(screen.getByRole("button", { name: "Archive PX0001" }))
  await user.click(screen.getByRole("button", { name: "Archive product" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("active sales records")
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
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
