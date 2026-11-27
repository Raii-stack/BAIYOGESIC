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

test("displays conflict error alert when product creation fails with HTTP 409", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && init?.method === "GET") {
      return success({ products: [product(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    }
    if (url.pathname === "/api/products" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: false, error: { message: "A product with that description already exists" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")

  await user.click(screen.getByRole("button", { name: "Add product" }))
  const dialog = screen.getByRole("dialog", { name: "Add Product" })
  await user.type(within(dialog).getByRole("textbox", { name: /Product Description/ }), "Existing Product")
  await user.selectOptions(within(dialog).getByRole("combobox", { name: /Unit Type/ }), "ea")
  await user.type(within(dialog).getByRole("spinbutton", { name: /Current Unit Price/ }), "25.00")
  await user.click(within(dialog).getByRole("button", { name: "Create product" }))

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("already exists")
})

test("displays error state when product fetching fails with HTTP 500", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products") {
      return new Response(JSON.stringify({ success: false, error: { message: "Internal server error" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent("The service is temporarily unavailable. Please try again.")
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
})

test("displays error in PriceHistoryModal when adding price fails with HTTP 400", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/products" && init?.method === "GET") {
      return success({ products: [product(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    }
    if (url.pathname === "/api/products/PX0001/prices" && init?.method === "GET") {
      return success({ prices: [{ effdate: "2026-10-01", unitprice: "12.50", stamp: "ADD admin" }] })
    }
    if (url.pathname === "/api/products/PX0001/price-history" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: false, error: { message: "Effective date cannot be in the past" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><InventoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Product 1")

  await user.click(screen.getByRole("button", { name: "Show price history for PX0001" }))
  await user.click(screen.getByRole("button", { name: "Manage prices" }))

  const modal = await screen.findByRole("dialog", { name: /Price History/i })
  await user.click(within(modal).getByRole("button", { name: "Add Price" }))

  const priceInput = within(modal).getByPlaceholderText("0.00")
  await user.type(priceInput, "15.00")
  await user.click(within(modal).getByRole("button", { name: "Save Price" }))

  expect(await within(modal).findByRole("alert")).toHaveTextContent("Effective date cannot be in the past")
})
