import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { AuthProvider } from "../components/auth/AuthProvider"
import EmployeeDirectoryPage from "./EmployeeDirectoryPage"

const response = (data: object) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json" } })
const auth = (role: string) => ({ userId: 1, empno: "00001", email: "user@example.com", role, status: "active", mustChangePassword: false })
const row = (number: number, salary: string | null = "50000") => ({ empno: String(number).padStart(5, "0"), firstname: `Person${number}`, lastname: "Example", email: `person${number}@example.com`, gender: null, birthdate: null, hiredate: "2022-01-01", sepdate: null, is_deleted: false, stamp: "ADD admin", jobcode: "DEV", deptcode: "IT", effdate: "2022-01-01", jobdesc: "Developer", deptname: "Information Tech", salary })

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test("loads employees with skeletons, filters, and working server pagination", async () => {
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => { release = resolve })
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("administrator") })
    if (url.pathname === "/api/employees/options") return response({ departments: [{ code: "IT", name: "Information Tech" }], jobs: [{ code: "DEV", name: "Developer" }] })
    if (url.pathname === "/api/employees") {
      expect(init?.credentials).toBe("include")
      const page = Number(url.searchParams.get("page"))
      if (page === 1 && !url.searchParams.has("department")) await gate
      const total = url.searchParams.has("department") ? 3 : 12
      return response({ employees: Array.from({ length: Math.min(10, total - (page - 1) * 10) }, (_, index) => row((page - 1) * 10 + index + 1)), pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) } })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText("Loading employee records…")).toBeInTheDocument()
  release?.()
  expect(await screen.findByText("Person1 Example")).toBeInTheDocument()
  expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Person11 Example")).toBeInTheDocument()
  expect(screen.getByText("Showing 11–12 of 12")).toBeInTheDocument()
  await user.selectOptions(screen.getByRole("combobox", { name: "Department" }), "IT")
  expect(await screen.findByText("Showing 1–3 of 3")).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("department=IT"))).toBe(true)
})

test("debounces searches and keeps salary and editing hidden from ordinary users", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("user") })
    if (url.pathname === "/api/employees/options") return response({ departments: [], jobs: [] })
    if (url.pathname === "/api/employees") return response({ employees: [row(1, null)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText("Person1 Example")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /Person1 Example/ })).getByLabelText("Salary hidden due to permissions")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Add employee/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Edit Person1/ })).not.toBeInTheDocument()
  const input = screen.getByRole("searchbox", { name: "Search employees" })
  fireEvent.change(input, { target: { value: "Per" } })
  fireEvent.change(input, { target: { value: "Person" } })
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/employees?"))).toHaveLength(1)
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/employees?"))).toHaveLength(2))
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=Person")
})

test("saves employee edits through the API and refreshes the directory", async () => {
  let updated = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("administrator") })
    if (url.pathname === "/api/employees/options") return response({ departments: [{ code: "IT", name: "Information Tech" }], jobs: [{ code: "DEV", name: "Developer" }] })
    if (url.pathname === "/api/employees" && init?.method === "GET") return response({ employees: [{ ...row(1), firstname: updated ? "Updated" : "Person1" }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/employees/00001" && init?.method === "PUT") {
      expect(init.credentials).toBe("include")
      expect(JSON.parse(String(init.body)).firstname).toBe("Updated")
      updated = true
      return response({ empno: "00001" })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Person1 Example")
  await user.click(screen.getByRole("button", { name: "Edit Person1 Example" }))
  const dialog = screen.getByRole("dialog", { name: "Edit employee" })
  const first = within(dialog).getByRole("textbox", { name: "First name" })
  await user.clear(first)
  await user.type(first, "Updated")
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }))
  expect(await screen.findByText("Updated Example")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Employee updated successfully")
})

test("expands inline job history and archives an employee through the API", async () => {
  let archived = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("administrator") })
    if (url.pathname === "/api/employees/options") return response({ departments: [{ code: "IT", name: "Information Tech" }], jobs: [{ code: "DEV", name: "Developer" }] })
    if (url.pathname === "/api/employees" && init?.method === "GET") return response({ employees: [{ ...row(1), is_deleted: archived }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/employees/00001" && init?.method === "GET") return response({ employee: row(1), history: [{ empno: "00001", jobcode: "DEV", deptcode: "IT", effdate: "2024-01-01", jobdesc: "Senior Developer", deptname: "Information Tech", salary: "65000", stamp: "EDIT admin" }] })
    if (url.pathname === "/api/employees/00001" && init?.method === "DELETE") {
      expect(init.credentials).toBe("include")
      archived = true
      return response({ empno: "00001" })
    }
    if (url.pathname === "/api/employees/00001/restore" && init?.method === "POST") {
      expect(init.credentials).toBe("include")
      archived = false
      return response({ empno: "00001" })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Person1 Example")
  await user.click(screen.getByRole("button", { name: "Show job history for Person1 Example" }))
  expect(await screen.findByText("Senior Developer")).toBeInTheDocument()
  expect(screen.getByText("$65,000")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Hide job history for Person1 Example" })).toHaveAttribute("aria-expanded", "true")

  await user.click(screen.getByRole("button", { name: "Archive Person1 Example" }))
  await user.click(screen.getByRole("button", { name: "Archive employee" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /Person1 Example/ })).getByText("Archived")).toBeInTheDocument())
  expect(screen.queryByRole("button", { name: "Archive Person1 Example" })).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Employee archived successfully")

  await user.click(screen.getByRole("button", { name: "Restore Person1 Example" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /Person1 Example/ })).getByText("Active")).toBeInTheDocument())
  expect(screen.getByRole("status")).toHaveTextContent("Employee restored successfully")
})

test("shows a clear archive error when an employee has active sales", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("administrator") })
    if (url.pathname === "/api/employees/options") return response({ departments: [], jobs: [] })
    if (url.pathname === "/api/employees" && init?.method === "GET") return response({ employees: [row(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/employees/00001" && init?.method === "DELETE") return new Response(JSON.stringify({ success: false, error: { message: "Cannot archive employee while active sales records exist." } }), { status: 409, headers: { "Content-Type": "application/json" } })
    throw new Error(`Unexpected request ${url.pathname}`)
  }))
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Person1 Example")
  await user.click(screen.getByRole("button", { name: "Archive Person1 Example" }))
  await user.click(screen.getByRole("button", { name: "Archive employee" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("active sales records")
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
})

test("archives an employee with separation date and updates directory status", async () => {
  let archived = false
  let capturedBody: any = null
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("administrator") })
    if (url.pathname === "/api/employees/options") return response({ departments: [{ code: "IT", name: "Information Tech" }], jobs: [{ code: "DEV", name: "Developer" }] })
    if (url.pathname === "/api/employees" && init?.method === "GET") return response({ employees: [{ ...row(1), is_deleted: archived, sepdate: archived ? "2026-10-31" : null }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/employees/00001" && init?.method === "DELETE") {
      expect(init.credentials).toBe("include")
      capturedBody = init.body ? JSON.parse(String(init.body)) : null
      archived = true
      return response({ empno: "00001", sepdate: "2026-10-31" })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Person1 Example")
  await user.click(screen.getByRole("button", { name: "Archive Person1 Example" }))
  const dateInput = screen.getByLabelText("Separation date")
  await user.clear(dateInput)
  await user.type(dateInput, "2026-10-31")
  await user.click(screen.getByRole("button", { name: "Archive employee" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /Person1 Example/ })).getByText("Archived")).toBeInTheDocument())
  expect(capturedBody).toEqual({ separation_date: "2026-10-31" })
  expect(screen.getByRole("status")).toHaveTextContent("Employee archived successfully")
})

test("switches between Employees, Jobs, and Departments tabs and manages lookup records", async () => {
  let jobs = [{ jobcode: "DEV", jobdesc: "Developer", is_deleted: false, stamp: "ADD admin" }]
  let departments = [{ deptcode: "IT", deptname: "Information Tech", is_deleted: false, stamp: "ADD admin" }]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return response({ user: auth("administrator") })
    if (url.pathname === "/api/employees/options") return response({ departments: [{ code: "IT", name: "Information Tech" }], jobs: [{ code: "DEV", name: "Developer" }] })
    if (url.pathname === "/api/employees" && init?.method === "GET") return response({ employees: [row(1)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/employees/jobs" && init?.method === "GET") return response({ jobs, pagination: { page: 1, limit: 10, total: jobs.length, totalPages: 1 } })
    if (url.pathname === "/api/employees/jobs/DEV" && init?.method === "DELETE") {
      jobs = jobs.map((j) => ({ ...j, is_deleted: true }))
      return response({ job: jobs[0] })
    }
    if (url.pathname === "/api/employees/jobs/DEV/restore" && init?.method === "POST") {
      jobs = jobs.map((j) => ({ ...j, is_deleted: false }))
      return response({ job: jobs[0] })
    }
    if (url.pathname === "/api/employees/departments" && init?.method === "GET") return response({ departments, pagination: { page: 1, limit: 10, total: departments.length, totalPages: 1 } })
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><EmployeeDirectoryPage /></AuthProvider></MemoryRouter>)
  await screen.findByText("Person1 Example")

  await user.click(screen.getByRole("tab", { name: "Jobs" }))
  expect(await screen.findByText("Developer")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Archive Developer" }))
  await user.click(screen.getByRole("button", { name: "Archive job" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /DEV/ })).getByText("Archived")).toBeInTheDocument())
  await user.click(screen.getByRole("button", { name: "Restore Developer" }))
  await waitFor(() => expect(within(screen.getByRole("row", { name: /DEV/ })).getByText("Active")).toBeInTheDocument())

  await user.click(screen.getByRole("tab", { name: "Departments" }))
  expect(await screen.findByText("Information Tech")).toBeInTheDocument()
})
