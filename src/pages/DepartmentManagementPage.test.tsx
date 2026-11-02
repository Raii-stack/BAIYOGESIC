import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../components/auth/AuthProvider"
import DepartmentManagementPage from "./DepartmentManagementPage"

const success = (data: object) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const adminUser = {
  userId: "admin-1",
  empno: "00001",
  name: "Admin User",
  email: "admin@hope.inc",
  role: "administrator",
  status: "active",
  mustChangePassword: false,
  rights: [
    "hr.access",
    "hr.department.add",
    "hr.department.edit",
    "hr.department.delete",
  ],
}

function department(code: string, name: string, employeeCount = 5, isDeleted = false) {
  return {
    deptcode: code,
    deptname: name,
    is_deleted: isDeleted,
    employee_count: employeeCount,
    employeeCount,
    stamp: "ADD admin 2026-10-21 09:00 AM",
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("loads active department records, displays headcount badges, and handles pagination", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminUser })
    if (url.pathname === "/api/departments" && (!init?.method || init.method === "GET")) {
      const page = Number(url.searchParams.get("page") || 1)
      const depts = page === 1
        ? [
            department("ENG", "Engineering", 12),
            department("SAL", "Sales & Marketing", 8),
          ]
        : [
            department("OPS", "Operations", 4),
          ]
      return success({
        departments: depts,
        pagination: { page, limit: 2, total: 3, totalPages: 2 },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <DepartmentManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("Loading department records…")).toBeInTheDocument()
  expect(await screen.findByText("Engineering")).toBeInTheDocument()
  expect(screen.getByText("Sales & Marketing")).toBeInTheDocument()
  expect(screen.getByText("12")).toBeInTheDocument()
  expect(screen.getByText("8")).toBeInTheDocument()
  expect(screen.getByText("Showing 1–2 of 3")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Operations")).toBeInTheDocument()
  expect(screen.getByText("4")).toBeInTheDocument()
  expect(screen.getByText("Showing 3–3 of 3")).toBeInTheDocument()
})

test("filters departments by search and status", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminUser })
    if (url.pathname === "/api/departments" && (!init?.method || init.method === "GET")) {
      const search = url.searchParams.get("search")
      const status = url.searchParams.get("status")
      if (search === "Eng") {
        return success({
          departments: [department("ENG", "Engineering", 10)],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        })
      }
      if (status === "archived") {
        return success({
          departments: [department("OLD", "Legacy Dept", 0, true)],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        })
      }
      return success({
        departments: [
          department("ENG", "Engineering", 10),
          department("HRD", "Human Resources", 3),
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <DepartmentManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("Engineering")).toBeInTheDocument()
  expect(screen.getByText("Human Resources")).toBeInTheDocument()

  const filterSection = screen.getByLabelText("Department filters")
  const searchInput = within(filterSection).getByRole("searchbox")
  fireEvent.change(searchInput, { target: { value: "Eng" } })
  await waitFor(() => {
    expect(screen.queryByText("Human Resources")).not.toBeInTheDocument()
    expect(screen.getByText("Engineering")).toBeInTheDocument()
  })

  fireEvent.change(searchInput, { target: { value: "" } })
  await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "archived")
  expect(await screen.findByText("Legacy Dept")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /Legacy Dept/ })).getByText("Archived")).toBeInTheDocument()
})

test("opens create modal, validates required fields and duplicate codes, and creates a department", async () => {
  let records = [department("ENG", "Engineering", 5)]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminUser })
    if (url.pathname === "/api/departments" && (!init?.method || init.method === "GET")) {
      return success({
        departments: records,
        pagination: { page: 1, limit: 10, total: records.length, totalPages: 1 },
      })
    }
    if (url.pathname === "/api/departments" && init?.method === "POST") {
      const body = JSON.parse(String(init.body))
      const created = department(body.deptcode, body.deptname, 0)
      records = [...records, created]
      return success({ department: created })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <DepartmentManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("Engineering")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Add department" }))

  const dialog = screen.getByRole("dialog", { name: "Add Department" })
  expect(dialog).toBeInTheDocument()

  // Click submit with empty fields
  await user.click(within(dialog).getByRole("button", { name: "Create department" }))
  expect(await within(dialog).findByText("Department code is required.")).toBeInTheDocument()
  expect(within(dialog).getByText("Department name is required.")).toBeInTheDocument()

  // Duplicate code warning
  await user.type(within(dialog).getByLabelText(/Department Code/), "ENG")
  await user.type(within(dialog).getByLabelText(/Department Name/), "Human Resources")
  await user.click(within(dialog).getByRole("button", { name: "Create department" }))
  expect(await within(dialog).findByText("A department with this code already exists.")).toBeInTheDocument()

  // Valid inputs
  await user.clear(within(dialog).getByLabelText(/Department Code/))
  await user.type(within(dialog).getByLabelText(/Department Code/), "HRD")
  await user.click(within(dialog).getByRole("button", { name: "Create department" }))

  expect(await screen.findByText("Human Resources")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Department created successfully.")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

test("edits department name in place without re-querying table", async () => {
  let listQueryCount = 0
  const records = [department("FIN", "Finance", 7)]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminUser })
    if (url.pathname === "/api/departments" && (!init?.method || init.method === "GET")) {
      listQueryCount++
      return success({
        departments: records,
        pagination: { page: 1, limit: 10, total: records.length, totalPages: 1 },
      })
    }
    if (url.pathname === "/api/departments/FIN" && init?.method === "PUT") {
      const body = JSON.parse(String(init.body))
      return success({ department: department("FIN", body.deptname, 7) })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <DepartmentManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("Finance")).toBeInTheDocument()
  expect(listQueryCount).toBe(1)

  await user.click(screen.getByRole("button", { name: "Edit Finance" }))
  const dialog = screen.getByRole("dialog", { name: "Edit Department" })
  expect(within(dialog).getByLabelText(/Department Code/)).toBeDisabled()

  await user.clear(within(dialog).getByLabelText(/Department Name/))
  await user.type(within(dialog).getByLabelText(/Department Name/), "Finance & Accounting")
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }))

  expect(await screen.findByText("Finance & Accounting")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Department updated successfully.")
  expect(listQueryCount).toBe(1) // No re-query
})

test("archives and restores department records, displaying conflict error when employees are assigned", async () => {
  let failArchive = true
  const records = [department("IT", "Information Tech", 3)]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminUser })
    if (url.pathname === "/api/departments" && (!init?.method || init.method === "GET")) {
      return success({
        departments: records,
        pagination: { page: 1, limit: 10, total: records.length, totalPages: 1 },
      })
    }
    if (url.pathname === "/api/departments/IT" && init?.method === "DELETE") {
      if (failArchive) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Cannot archive department while active employee assignments exist." },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        )
      }
      return success({ department: department("IT", "Information Tech", 0, true) })
    }
    if (url.pathname === "/api/departments/IT/restore" && init?.method === "POST") {
      return success({ department: department("IT", "Information Tech", 0, false) })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <DepartmentManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("Information Tech")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Archive Information Tech" }))

  const alertdialog = screen.getByRole("alertdialog")
  expect(alertdialog).toBeInTheDocument()

  // Attempt archive and receive 409 conflict
  await user.click(within(alertdialog).getByRole("button", { name: "Yes, Archive Department" }))
  expect(
    await within(alertdialog).findByText("Cannot archive department while active employee assignments exist."),
  ).toBeInTheDocument()

  // Retry when conflict cleared
  failArchive = false
  await user.click(within(alertdialog).getByRole("button", { name: "Yes, Archive Department" }))

  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /Information Tech/ })).getByText("Archived")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("Department archived successfully.")

  // Restore department
  await user.click(screen.getByRole("button", { name: "Restore Information Tech" }))
  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /Information Tech/ })).getByText("Active")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("Department restored successfully.")
})
