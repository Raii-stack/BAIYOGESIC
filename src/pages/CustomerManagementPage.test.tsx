import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../components/auth/AuthProvider"
import CustomerManagementPage from "./CustomerManagementPage"

const success = (data: object) => new Response(JSON.stringify({ success: true, data }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
})

const admin = {
  userId: 1,
  empno: "EMP-1",
  email: "admin@example.com",
  role: "administrator",
  status: "active",
  mustChangePassword: false,
}

function customer(number: number, payterm = "30D") {
  return {
    custno: `CUS-${number}`,
    custname: `Customer ${number}`,
    address: `${number} Market Street`,
    payterm,
    is_deleted: false,
    stamp: "ADD admin 2026-10-21 09:00 AM",
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("loads customer pages, shows skeletons, and applies server-side payment term filters", async () => {
  let releaseFirstPage: (() => void) | undefined
  const firstPageGate = new Promise<void>((resolve) => { releaseFirstPage = resolve })
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/customers") {
      expect(init?.credentials).toBe("include")
      const page = Number(url.searchParams.get("page"))
      const payterm = url.searchParams.get("payterm")
      if (page === 1 && !payterm) await firstPageGate
      const status = url.searchParams.get("status")
      const total = status === "archived" ? 3 : payterm ? 7 : 23
      const first = (page - 1) * 10 + 1
      return success({
        customers: Array.from({ length: Math.max(0, Math.min(10, total - first + 1)) }, (_, index) => ({ ...customer(first + index, payterm || ["30D", "45D", "COD"][index % 3]), is_deleted: status === "archived" || (!status && first + index === 3) })),
        pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><CustomerManagementPage /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText("Loading customer records…")).toBeInTheDocument()
  expect(screen.queryByText("Customer 1")).not.toBeInTheDocument()
  releaseFirstPage?.()

  expect(await screen.findByText("Customer 1")).toBeInTheDocument()
  expect(screen.getByText("Showing 1–10 of 23")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /Customer 1 / })).getByText("Net 30")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /Customer 2 / })).getByText("Net 45")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /Customer 3 / })).getByText("Cash on delivery")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /Customer 3 / })).getByText("Archived")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit Customer 3" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Customer 11")).toBeInTheDocument()
  expect(screen.getByText("Showing 11–20 of 23")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page")

  await user.click(screen.getByRole("button", { name: "Page 3" }))
  expect(await screen.findByText("Customer 21")).toBeInTheDocument()
  expect(screen.getByText("Showing 21–23 of 23")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Previous" }))
  expect(await screen.findByText("Customer 11")).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText("Payment terms"), "30D")
  await waitFor(() => expect(screen.getByText("Showing 1–7 of 7")).toBeInTheDocument())
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("payterm=30D"))).toBe(true)
  await user.selectOptions(screen.getByLabelText("Status"), "archived")
  await waitFor(() => expect(screen.getByText("Showing 1–3 of 3")).toBeInTheDocument())
  expect(within(screen.getByRole("table")).getAllByText("Archived")).toHaveLength(3)
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("status=archived"))).toBe(true)
})

test("waits for a pause in typing before searching customers", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/customers") return success({ customers: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter><AuthProvider><CustomerManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Showing 0–0 of 0")
  const search = screen.getByRole("searchbox", { name: "Search customers" })
  fireEvent.change(search, { target: { value: "Cu" } })
  fireEvent.change(search, { target: { value: "Cust" } })
  fireEvent.change(search, { target: { value: "Customer" } })
  expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/customers"))).toHaveLength(1)
  await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/customers"))).toHaveLength(2))
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=Customer")
})

test("sends customer edits to the API and reloads the directory after saving", async () => {
  let saved = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/customers" && init?.method === "GET") {
      return success({ customers: [{ ...customer(1), custname: saved ? "Updated account" : "Customer 1" }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    }
    if (url.pathname === "/api/customers/CUS-1" && init?.method === "PUT") {
      expect(init.credentials).toBe("include")
      expect(JSON.parse(String(init.body))).toEqual({ custname: "Updated account", address: "1 Market Street", payterm: "45D" })
      saved = true
      return success({ customer: { ...customer(1, "45D"), custname: "Updated account" } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><CustomerManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Customer 1")
  await user.click(screen.getByRole("button", { name: "Edit Customer 1" }))
  const dialog = screen.getByRole("dialog", { name: "Customer Details" })
  await user.clear(within(dialog).getByRole("textbox", { name: /Customer Name/ }))
  await user.type(within(dialog).getByRole("textbox", { name: /Customer Name/ }), "Updated account")
  await user.selectOptions(within(dialog).getByRole("combobox", { name: /Payment Terms/ }), "45D")
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }))

  expect(await screen.findByText("Updated account")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Customer updated successfully")
  await user.click(screen.getByRole("button", { name: "Dismiss notification" }))
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

test("creates and archives customers through the API", async () => {
  let records = [customer(1)]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/customers" && init?.method === "GET") {
      return success({ customers: records, pagination: { page: 1, limit: 10, total: records.length, totalPages: 1 } })
    }
    if (url.pathname === "/api/customers" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toEqual({ custname: "New account", address: "2 Main Road", payterm: "COD" })
      records = [...records, { ...customer(2, "COD"), custname: "New account", address: "2 Main Road" }]
      return success({ customer: records[1] })
    }
    if (url.pathname === "/api/customers/CUS-2" && init?.method === "DELETE") {
      records = records.map((record) => record.custno === "CUS-2" ? { ...record, is_deleted: true } : record)
      return success({ customer: { ...customer(2), is_deleted: true } })
    }
    if (url.pathname === "/api/customers/CUS-2/restore" && init?.method === "POST") {
      records = records.map((record) => record.custno === "CUS-2" ? { ...record, is_deleted: false } : record)
      return success({ customer: { ...customer(2), is_deleted: false } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(<MemoryRouter><AuthProvider><CustomerManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Customer 1")
  await user.click(screen.getByRole("button", { name: "Add customer" }))
  const dialog = screen.getByRole("dialog", { name: "Customer Details" })
  await user.type(within(dialog).getByRole("textbox", { name: /Customer Name/ }), "New account")
  await user.type(within(dialog).getByRole("textbox", { name: /Address/ }), "2 Main Road")
  await user.selectOptions(within(dialog).getByRole("combobox", { name: /Payment Terms/ }), "COD")
  await user.click(within(dialog).getByRole("button", { name: "Create customer" }))
  expect(await screen.findByText("New account")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Customer created successfully")

  await user.click(screen.getByRole("button", { name: "Archive New account" }))
  await user.click(screen.getByRole("button", { name: "Yes, Archive Record" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /New account/ })).getByText("Archived")).toBeInTheDocument())
  expect(screen.queryByRole("button", { name: "Archive New account" })).not.toBeInTheDocument()
  expect(screen.getByText("Showing 1–2 of 2")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Customer archived successfully")
  expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/CUS-2") && init?.method === "DELETE")).toBe(true)

  await user.click(screen.getByRole("button", { name: "Restore New account" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /New account/ })).getByText("Active")).toBeInTheDocument())
  expect(screen.getByRole("status")).toHaveTextContent("Customer restored successfully")
})

test("explains why a customer with active sales cannot be archived", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: admin })
    if (url.pathname === "/api/customers" && init?.method === "GET") return success({ customers: [customer(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/customers/CUS-1" && init?.method === "DELETE") return new Response(JSON.stringify({ success: false, error: { message: "Cannot archive customer while active sales records exist." } }), { status: 409, headers: { "Content-Type": "application/json" } })
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><CustomerManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Customer 1")
  await user.click(screen.getByRole("button", { name: "Archive Customer 1" }))
  await user.click(screen.getByRole("button", { name: "Yes, Archive Record" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("active sales records")
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Archive Customer 1" })).toBeInTheDocument()
})
