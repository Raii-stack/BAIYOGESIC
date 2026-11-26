import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
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

test("enforces granular per-right permissions (products.add, products.edit, products.delete)", async () => {
  const rows = [product(1), { ...product(2), is_deleted: true }]
  const makeFetch = (rights: string[]) => vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: { ...admin, role: "employee", rights } })
    if (url.pathname === "/api/products" && (!init?.method || init.method === "GET")) {
      return success({ products: rows, pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } })
    }
    if (url.pathname === "/api/products/PX0001/prices") {
      return success({ prices: [{ effdate: "2026-10-01", unitprice: "12.50", stamp: "ADD admin" }] })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  const user = userEvent.setup()

  // 1. products.add only: shows Add product, hides Edit/Archive/Restore, Manage prices, and audit columns
  vi.stubGlobal("fetch", makeFetch(["products.access", "products.add"]))
  const { unmount: unmountAdd } = render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit PX0001" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Archive PX0001" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Restore PX0002" })).not.toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show price history for PX0001" }))
  await screen.findByText("Recorded effective prices for this product.")
  expect(screen.queryByRole("button", { name: "Manage prices" })).not.toBeInTheDocument()
  unmountAdd()

  // 2. products.edit only: shows Edit and Manage prices, hides Add product/Archive/Restore and audit columns
  vi.stubGlobal("fetch", makeFetch(["products.access", "products.edit"]))
  const { unmount: unmountEdit } = render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  expect(screen.queryByRole("button", { name: "Add product" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Edit PX0001" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Archive PX0001" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Restore PX0002" })).not.toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show price history for PX0001" }))
  expect(await screen.findByRole("button", { name: "Manage prices" })).toBeInTheDocument()
  unmountEdit()

  // 3. products.delete only: shows Archive/Restore and audit columns, hides Add product/Edit/Manage prices
  vi.stubGlobal("fetch", makeFetch(["products.access", "products.delete"]))
  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")
  expect(screen.queryByRole("button", { name: "Add product" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit PX0001" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Archive PX0001" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Restore PX0002" })).toBeInTheDocument()
  expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
})

test("keeps product active on HTTP 409/403 archive failure and keeps product archived on restore failure", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && (!init?.method || init.method === "GET")) {
      return success({
        products: [product(1), { ...product(2), is_deleted: true }],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      })
    }
    if (url.pathname === "/api/products/PX0001" && init?.method === "DELETE") {
      return new Response(JSON.stringify({ success: false, error: { message: "Cannot archive product while active sales records exist." } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    }
    if (url.pathname === "/api/products/PX0002/restore" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: false, error: { message: "Insufficient permissions", statusCode: 403 } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")

  // 409 on archive keeps product Active
  await user.click(screen.getByRole("button", { name: "Archive PX0001" }))
  await user.click(screen.getByRole("button", { name: "Archive product" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("active sales records")
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(within(screen.getByRole("row", { name: /PX0001 Product 1/ })).getByText("Active")).toBeInTheDocument()

  // 403 on restore keeps product Archived
  await user.click(screen.getByRole("button", { name: "Restore PX0002" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Restore PX0002" })).toBeEnabled())
  expect(within(screen.getByRole("row", { name: /PX0002 Product 2/ })).getByText("Archived")).toBeInTheDocument()
})
