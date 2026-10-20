import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../components/auth/AuthProvider"
import UserManagementPage from "./UserManagementPage"

const success = (data: object) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const superAdminSession = {
  userId: "00000000-0000-0000-0000-000000000001",
  empno: "00019",
  email: "esperanza.nehemiah@hope.inc",
  role: "superadmin",
  status: "active",
  isBlocked: false,
  mustChangePassword: false,
  rights: [],
}

const adminSession = {
  userId: "00000000-0000-0000-0000-000000000002",
  empno: "00009",
  email: "cerudo.bambie@hope.inc",
  role: "admin",
  status: "active",
  isBlocked: false,
  mustChangePassword: false,
  rights: [],
}

function makeUser(
  index: number,
  role: "superadmin" | "admin" | "employee" = "employee",
  isBlocked = false,
) {
  return {
    userId: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    empno: String(index).padStart(5, "0"),
    firstName: `User${index}`,
    lastName: "Account",
    name: `User${index} Account`,
    email: `user${index}@hope.inc`,
    role,
    status: "active" as const,
    isBlocked,
    mustChangePassword: false,
    jobTitle: role === "admin" ? "Manager" : "Sales Agent",
    departmentName: "Sales Branch 1",
    stamp: "ADD system 2026-10-21 09:00 AM",
    rights: role === "employee" ? ["customers.access", "sales.access"] : [],
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("loads user accounts with skeletons, filters, and server pagination for superadmin", async () => {
  let releaseFirstPage: (() => void) | undefined
  const firstPageGate = new Promise<void>((resolve) => {
    releaseFirstPage = resolve
  })

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      expect(init?.credentials).toBe("include")
      const page = Number(url.searchParams.get("page"))
      const role = url.searchParams.get("role")
      if (page === 1 && !role) await firstPageGate
      const total = role === "admin" ? 3 : 14
      const first = (page - 1) * 10 + 1
      return success({
        users: Array.from(
          { length: Math.max(0, Math.min(10, total - first + 1)) },
          (_, idx) =>
            makeUser(
              first + idx,
              role === "admin" ? "admin" : first + idx === 1 ? "superadmin" : "employee",
            ),
        ),
        pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) },
      })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <UserManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("Loading user accounts…")).toBeInTheDocument()
  releaseFirstPage?.()

  expect(await screen.findByText("User1 Account")).toBeInTheDocument()
  expect(screen.getByText("Showing 1–10 of 14")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /User1 Account/ })).getByText("SUPERADMIN")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("User11 Account")).toBeInTheDocument()
  expect(screen.getByText("Showing 11–14 of 14")).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText("Role"), "admin")
  await waitFor(() => expect(screen.getByText("Showing 1–3 of 3")).toBeInTheDocument())
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("role=admin"))).toBe(true)
})

test("enforces Admin visibility and action rules (Admin rows show — while Employee rows have Block, Rights, and Edit)", async () => {
  let users = [makeUser(2, "admin", false), makeUser(3, "employee", false)]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      return success({
        users,
        pagination: { page: 1, limit: 10, total: users.length, totalPages: 1 },
      })
    }
    if (url.pathname === `/api/users/${users[1].userId}/block` && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body))
      users = users.map((u, idx) => (idx === 1 ? { ...u, isBlocked: body.isBlocked } : u))
      return success({ user: users[1] })
    }
    if (url.pathname === `/api/users/${users[1].userId}/rights` && init?.method === "PUT") {
      const body = JSON.parse(String(init.body))
      users = users.map((u, idx) => (idx === 1 ? { ...u, rights: body.rights } : u))
      return success({ user: users[1] })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <UserManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText("User2 Account")).toBeInTheDocument()
  const adminRow = screen.getByRole("row", { name: /User2 Account/ })
  expect(within(adminRow).getByLabelText("Privileged accounts cannot be modified")).toHaveTextContent("—")

  const employeeRow = screen.getByRole("row", { name: /User3 Account/ })
  await user.click(within(employeeRow).getByRole("button", { name: "Block User3 Account" }))
  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /User3 Account/ })).getByText("Blocked")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("User3 Account has been blocked.")

  await user.click(screen.getByRole("button", { name: "Rights for User3 Account" }))
  const dialog = screen.getByRole("dialog", { name: /Rights — User3 Account/ })
  await user.click(within(dialog).getByRole("switch", { name: "Add Customer" }))
  await user.click(within(dialog).getByRole("button", { name: "Save Rights" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(screen.getByRole("status")).toHaveTextContent("User permissions updated successfully.")
})

test("creates and edits a user account through the slide-over panel", async () => {
  let users = [makeUser(1, "superadmin", false)]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") {
      return success({
        availableEmployees: [
          {
            empno: "00025",
            firstName: "Maria",
            lastName: "Santos",
            name: "Maria Santos",
            email: "santos.maria@hope.inc",
            jobTitle: "Analyst",
            departmentName: "Accounting",
          },
        ],
      })
    }
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      return success({
        users,
        pagination: { page: 1, limit: 10, total: users.length, totalPages: 1 },
      })
    }
    if (url.pathname === "/api/users" && init?.method === "POST") {
      const payload = JSON.parse(String(init.body))
      const created = {
        ...makeUser(25, payload.role, false),
        empno: payload.empno || "00025",
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: `${payload.firstName} ${payload.lastName}`,
        email: payload.email,
      }
      users = [...users, created]
      return success({ user: created })
    }
    if (url.pathname === `/api/users/${users[1]?.userId}` && init?.method === "PUT") {
      const payload = JSON.parse(String(init.body))
      users[1] = {
        ...users[1],
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: `${payload.firstName} ${payload.lastName}`,
        email: payload.email,
        role: payload.role,
      }
      return success({ user: users[1] })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <AuthProvider>
        <UserManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  await screen.findByText("User1 Account")
  await user.click(screen.getByRole("button", { name: /Add user/i }))
  const panel = screen.getByRole("dialog", { name: "Add User Account" })
  await user.selectOptions(within(panel).getByLabelText(/Link to Existing Employee/i), "00025")
  await user.type(within(panel).getByLabelText(/Temporary Password/i), "Secret123!")
  await user.click(within(panel).getByRole("button", { name: "Create user" }))

  expect(await screen.findByText("Maria Santos")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("User account created successfully.")

  await user.click(screen.getByRole("button", { name: "Edit Maria Santos" }))
  const editPanel = screen.getByRole("dialog", { name: "Edit User Account" })
  await user.selectOptions(within(editPanel).getByLabelText(/Account Role/i), "admin")
  await user.click(within(editPanel).getByRole("button", { name: "Save changes" }))

  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /Maria Santos/ })).getByText("ADMIN")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("User account updated successfully.")
})

test("waits for a pause in typing before searching users", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users") {
      return success({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)

  render(
    <MemoryRouter>
      <AuthProvider>
        <UserManagementPage />
      </AuthProvider>
    </MemoryRouter>,
  )

  await screen.findByText("Showing 0–0 of 0")
  const search = screen.getByRole("searchbox", { name: "Search users" })
  fireEvent.change(search, { target: { value: "Sm" } })
  fireEvent.change(search, { target: { value: "Smi" } })
  fireEvent.change(search, { target: { value: "Smith" } })

  expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/users?"))).toHaveLength(1)
  await waitFor(() =>
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/users?"))).toHaveLength(2),
  )
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=Smith")
})
