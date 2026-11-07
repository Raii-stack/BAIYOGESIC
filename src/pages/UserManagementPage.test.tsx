import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../components/auth/AuthProvider"
import { departmentPermissionPresets } from "../lib/users"
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
    lastActiveAt: "2026-11-06T09:10:00.000Z",
    rights: role === "employee" ? ["customers.access", "sales.access"] : [],
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("keeps role badges in user rows and shows permissions only in expanded details without duplicating departments", async () => {
  const manager = { ...makeUser(2, "admin"), rights: departmentPermissionPresets.find((preset) => preset.id === "hr-manager")!.rights }
  const employee = { ...makeUser(3), rights: departmentPermissionPresets.find((preset) => preset.id === "inventory-employee")!.rights }
  const custom = { ...makeUser(4, "admin"), rights: ["sales.access"], departmentName: null }
  const users = [makeUser(1, "superadmin"), manager, employee, custom]
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users") return success({ users, pagination: { page: 1, limit: 10, total: users.length, totalPages: 1 } })
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))

  render(<MemoryRouter><AuthProvider><UserManagementPage /></AuthProvider></MemoryRouter>)

  const managerRow = within(await screen.findByRole("row", { name: "User2 Account", exact: true }))
  expect(managerRow.getByText("Manager (Admin)")).toBeInTheDocument()
  expect(managerRow.queryByText(/Human Resources|Sales Branch 1/)).not.toBeInTheDocument()
  expect(screen.getByRole("option", { name: "Manager (Admin)", exact: true })).toHaveValue("admin")

  const employeeRow = within(screen.getByRole("row", { name: "User3 Account", exact: true }))
  expect(employeeRow.getByText("Employee")).toBeInTheDocument()
  const customRow = within(screen.getByRole("row", { name: "User4 Account", exact: true }))
  expect(customRow.getByText("Manager (Admin)")).toBeInTheDocument()
  const user = userEvent.setup()
  for (const [name, profile, department] of [
    ["User2 Account", "Human Resources — Manager", "Sales Branch 1"],
    ["User3 Account", "Inventory & Products — Employee", "Sales Branch 1"],
    ["User4 Account", "Custom permissions", "—"],
    ["User1 Account", "All Departments — Full Access", "Sales Branch 1"],
  ]) {
    const records = within(screen.getByRole("region", { name: "User account records" }))
    expect(records.queryByText(profile, { exact: true })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: `Expand details for ${name}` }))
    const details = within(screen.getByRole("region", { name: `Details for ${name}` }))
    expect(details.getByText("Permissions")).toBeInTheDocument()
    expect(details.getByText(profile, { exact: true })).toBeInTheDocument()
    expect(details.getAllByText("Department", { exact: true })).toHaveLength(1)
    expect(details.getByText("Department", { exact: true }).nextElementSibling).toHaveTextContent(department)
    await user.click(screen.getByRole("button", { name: `Collapse details for ${name}` }))
    expect(records.queryByText(profile, { exact: true })).not.toBeInTheDocument()
  }
})

test("notification links switch an open user directory to pending accounts and keep pagination working", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: adminSession })
    if (url.pathname === "/api/auth/activity") return success({ message: "ok" })
    if (url.pathname === "/api/auth/registration-notifications") return success({ total: 20, registrations: [{ userId: "5", name: "New applicant", email: "new@hope.inc", createdAt: "2026-11-02T10:00:00.000Z" }] })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users") {
      const page = Number(url.searchParams.get("page"))
      return success({ users: Array.from({ length: 10 }, (_, i) => ({ ...makeUser((page - 1) * 10 + i + 1), status: url.searchParams.get("status") === "pending" ? "pending" : "active" })), pagination: { page, limit: 10, total: 20, totalPages: 2 } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={["/users?page=1"]}><AuthProvider><UserManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByRole("row", { name: "User1 Account", exact: true })
  expect(within(screen.getByRole("region", { name: "User account records" })).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Surname", "Name", "Email", "Role", "Access", "Actions"])
  const firstRow = within(screen.getByRole("row", { name: "User1 Account", exact: true }))
  expect(firstRow.getByText("Account", { exact: true })).toBeInTheDocument()
  expect(firstRow.getByRole("cell", { name: "User1", exact: true })).toBeInTheDocument()
  expect(firstRow.getByRole("cell", { name: "user1@hope.inc", exact: true })).toBeInTheDocument()
  expect(firstRow.getByRole("cell", { name: "Active", exact: true })).toBeInTheDocument()
  expect(screen.queryByText("Last active")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Expand details for User1 Account" }))
  expect(screen.getByRole("region", { name: "Details for User1 Account" })).toHaveTextContent("Last active")
  expect(document.querySelector('time[datetime="2026-11-06T09:10:00.000Z"]')).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Collapse details for User1 Account" }))
  expect(screen.queryByRole("region", { name: "Details for User1 Account" })).not.toBeInTheDocument()
  await user.click(screen.getByTitle("Notifications"))
  await user.click(await screen.findByRole("link", { name: "View pending accounts (20)" }))
  await waitFor(() => expect(screen.getByLabelText("Status")).toHaveValue("pending"))
  await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled())
  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByRole("row", { name: "User11 Account", exact: true })).toBeInTheDocument()
  expect(screen.getByText("Showing 11–20 of 20")).toBeInTheDocument()
})

test("HR can approve pending employees without user-editing controls", async () => {
  let pending = true
  const applicant = { ...makeUser(5), status: "pending" as const }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: { ...adminSession, role: "employee", rights: ["hr.employee.edit"] } })
    if (url.pathname === "/api/auth/activity") return success({ message: "ok" })
    if (url.pathname === "/api/users") {
      expect(url.searchParams.get("role")).toBe("employee")
      expect(url.searchParams.get("status")).toBe("pending")
      return success({ users: pending ? [applicant] : [], pagination: { page: 1, limit: 10, total: pending ? 1 : 0, totalPages: pending ? 1 : 0 } })
    }
    if (url.pathname === `/api/users/${applicant.userId}/approve` && init?.method === "POST") {
      pending = false
      return success({ user: { ...applicant, status: "active" } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><UserManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByRole("row", { name: "User5 Account", exact: true })
  expect(screen.getByRole("heading", { name: "Pending registrations" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Add user" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /^(Edit|Block|Rights for)/ })).not.toBeInTheDocument()
  expect(screen.getByLabelText("Role")).toBeDisabled()
  expect(screen.getByLabelText("Status")).toHaveValue("pending")
  await user.click(screen.getByRole("button", { name: "Accept User5 Account" }))
  expect(await screen.findByText("No user accounts found")).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/users/options"))).toBe(false)
})

test("HR can reject a registration without a block action and remove it from the queue", async () => {
  let pending = true
  const applicant = { ...makeUser(5), status: "pending" as const }
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: { ...adminSession, role: "employee", rights: ["hr.employee.edit"] } })
    if (url.pathname === "/api/auth/activity") return success({ message: "ok" })
    if (url.pathname === "/api/users") return success({ users: pending ? [applicant] : [], pagination: { page: 1, limit: 10, total: pending ? 1 : 0, totalPages: pending ? 1 : 0 } })
    if (url.pathname === `/api/users/${applicant.userId}/reject` && init?.method === "POST") {
      pending = false
      return success({ user: { ...applicant, status: "disabled" } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))
  render(<MemoryRouter><AuthProvider><UserManagementPage /></AuthProvider></MemoryRouter>)
  await screen.findByRole("row", { name: "User5 Account", exact: true })
  expect(screen.queryByRole("button", { name: "Block User5 Account" })).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole("button", { name: "Reject User5 Account" }))
  expect(await screen.findByText("No user accounts found")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("User5 Account's registration has been rejected.")
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

  expect(await screen.findByRole("row", { name: "User1 Account", exact: true })).toBeInTheDocument()
  expect(screen.getByText("Showing 1–10 of 14")).toBeInTheDocument()
  expect(within(screen.getByRole("row", { name: /User1 Account/ })).getByText("Superadmin")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByRole("row", { name: "User11 Account", exact: true })).toBeInTheDocument()
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

  expect(await screen.findByRole("row", { name: "User2 Account", exact: true })).toBeInTheDocument()
  const adminRow = screen.getByRole("row", { name: /User2 Account/ })
  expect(within(adminRow).queryByRole("button", { name: /^(Block|Unblock|Rights for|Edit) / })).not.toBeInTheDocument()
  expect(within(adminRow).getByRole("button", { name: "Expand details for User2 Account" })).toBeInTheDocument()

  const employeeRow = screen.getByRole("row", { name: /User3 Account/ })
  await user.click(within(employeeRow).getByRole("button", { name: "Block User3 Account" }))
  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /User3 Account/ })).getByText("Blocked")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("User3 Account has been blocked.")

  await user.click(screen.getByRole("button", { name: "Rights for User3 Account" }))
  const dialog = screen.getByRole("dialog", { name: /Rights — User3 Account/ })
  expect(
    within(dialog).getByRole("option", { name: "Sales & CRM — Manager" }),
  ).toBeDisabled()
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

  await screen.findByRole("row", { name: "User1 Account", exact: true })
  await user.click(screen.getByRole("button", { name: /Add user/i }))
  const panel = screen.getByRole("dialog", { name: "Add User Account" })
  await user.selectOptions(within(panel).getByLabelText(/Link to Existing Employee/i), "00025")
  await user.type(within(panel).getByLabelText(/Temporary Password/i), "Secret123!")
  await user.click(within(panel).getByRole("button", { name: "Create user" }))

  expect(await screen.findByRole("row", { name: "Maria Santos", exact: true })).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("User account created successfully.")

  await user.click(screen.getByRole("button", { name: "Edit Maria Santos" }))
  const editPanel = screen.getByRole("dialog", { name: "Edit User Account" })
  await user.selectOptions(within(editPanel).getByLabelText(/Account Role/i), "admin")
  await user.click(within(editPanel).getByRole("button", { name: "Save changes" }))

  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /Maria Santos/ })).getByText("Manager (Admin)")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("User account updated successfully.")
})

test("explains a demotion and refreshes the table and permissions editor with employee rights", async () => {
  const employeePreset = departmentPermissionPresets.find((preset) => preset.id === "all-employee")!
  let target = { ...makeUser(3, "superadmin"), rights: departmentPermissionPresets.find((preset) => preset.id === "all-manager")!.rights }
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users") return success({ users: [target], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === `/api/users/${target.userId}` && init?.method === "PUT") {
      expect(JSON.parse(String(init.body)).role).toBe("employee")
      target = { ...target, role: "employee", rights: employeePreset.rights }
      return success({ user: target })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }))
  const user = userEvent.setup()
  render(<MemoryRouter><AuthProvider><UserManagementPage /></AuthProvider></MemoryRouter>)
  await user.click(await screen.findByRole("button", { name: "Edit User3 Account" }))
  const panel = within(screen.getByRole("dialog", { name: "Edit User Account" }))
  await user.selectOptions(panel.getByLabelText(/Account Role/i), "employee")
  expect(panel.getByText(/replaces current permissions with Employee read-only access/)).toBeInTheDocument()
  await user.click(panel.getByRole("button", { name: "Save changes" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(within(screen.getByRole("row", { name: "User3 Account", exact: true })).getByText("Employee")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Expand details for User3 Account" }))
  expect(within(screen.getByRole("region", { name: "Details for User3 Account" })).getByText(employeePreset.label)).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Rights for User3 Account" }))
  const rights = within(screen.getByRole("dialog", { name: "Rights — User3 Account" }))
  expect(rights.getByLabelText("Permission preset configuration")).toHaveValue("all-employee")
  expect(rights.getByRole("switch", { name: "Delete Customer" })).toHaveAttribute("aria-checked", "false")
  expect(rights.getByRole("switch", { name: "Add Employee" })).toHaveAttribute("aria-checked", "false")
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

test("allows superadmin to edit rights of admin and other superadmin accounts and accept pending accounts", async () => {
  let users = [
    { ...makeUser(2, "superadmin", false), status: "pending" as const },
    makeUser(3, "admin", false),
  ]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      return success({
        users,
        pagination: { page: 1, limit: 10, total: users.length, totalPages: 1 },
      })
    }
    if (url.pathname === `/api/users/${users[0].userId}/approve` && init?.method === "POST") {
      users = users.map((u, idx) => (idx === 0 ? { ...u, status: "active" as const } : u))
      return success({ user: users[0] })
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

  expect(await screen.findByRole("row", { name: "User2 Account", exact: true })).toBeInTheDocument()
  const otherSuperRow = await screen.findByRole("row", { name: /User2 Account/ })
  expect(within(otherSuperRow).getByText("Pending")).toBeInTheDocument()
  expect(within(otherSuperRow).queryByRole("button", { name: "Block User2 Account" })).not.toBeInTheDocument()
  expect(within(otherSuperRow).getByRole("button", { name: "Reject User2 Account" })).toBeInTheDocument()
  expect(within(otherSuperRow).getByRole("button", { name: "Rights for User2 Account" })).toBeInTheDocument()

  await user.click(within(otherSuperRow).getByRole("button", { name: "Accept User2 Account" }))
  await waitFor(() =>
    expect(within(screen.getByRole("row", { name: /User2 Account/ })).getByText("Active")).toBeInTheDocument(),
  )
  expect(screen.getByRole("status")).toHaveTextContent("User2 Account has been accepted and activated.")
  const getUserCallsAfterApprove = fetchMock.mock.calls.filter(([input, init]) => {
    const url = new URL(String(input), "http://localhost")
    return url.pathname === "/api/users" && (!init?.method || init?.method === "GET")
  })
  expect(getUserCallsAfterApprove).toHaveLength(1)

  const adminRow = await screen.findByRole("row", { name: /User3 Account/ })
  await user.click(within(adminRow).getByRole("button", { name: "Rights for User3 Account" }))
  const dialog = screen.getByRole("dialog", { name: /Rights — User3 Account/ })
  await user.click(within(dialog).getByRole("switch", { name: "Add Customer" }))
  await user.click(within(dialog).getByRole("button", { name: "Save Rights" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(screen.getByRole("status")).toHaveTextContent("User permissions updated successfully.")
})

test("applies department and module permission presets in the Rights modal", async () => {
  let savedRights: string[] = []
  let savedRole = ""
  const users = [makeUser(3, "employee", false)]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      return success({
        users,
        pagination: { page: 1, limit: 10, total: users.length, totalPages: 1 },
      })
    }
    if (url.pathname === `/api/users/${users[0].userId}/rights` && init?.method === "PUT") {
      const body = JSON.parse(String(init.body))
      savedRights = body.rights
      savedRole = body.role
      return success({ user: { ...users[0], rights: savedRights } })
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

  expect(await screen.findByRole("row", { name: "User3 Account", exact: true })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Rights for User3 Account" }))
  const dialog = screen.getByRole("dialog", { name: /Rights — User3 Account/ })

  const presetSelect = within(dialog).getByLabelText("Permission preset configuration")
  await user.selectOptions(presetSelect, "sales-manager")

  expect(within(dialog).getByRole("switch", { name: "Add Customer" })).toHaveAttribute("aria-checked", "true")
  expect(within(dialog).getByRole("switch", { name: "Delete Sale" })).toHaveAttribute("aria-checked", "true")
  expect(within(dialog).getByRole("switch", { name: "Add Employee" })).toHaveAttribute("aria-checked", "false")

  const hrModuleSelect = within(dialog).getByLabelText("Human Resources role preset")
  await user.selectOptions(hrModuleSelect, "employee")
  expect(within(dialog).getByRole("checkbox", { name: "Enable Human Resources module" })).toBeChecked()
  expect(within(dialog).getByRole("switch", { name: "View Job History" })).toHaveAttribute("aria-checked", "true")
  expect(within(dialog).getByRole("switch", { name: "Delete Employee" })).toHaveAttribute("aria-checked", "false")

  await user.click(within(dialog).getByRole("button", { name: "Save Rights" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(savedRights).toContain("customers.add")
  expect(savedRights).toContain("sales.delete")
  expect(savedRights).toContain("hr.access")
  expect(savedRights).toContain("hr.history.view")
  expect(savedRights).not.toContain("hr.employee.delete")
  expect(savedRole).toBe("employee")
})

test("keeps the saved preset visible and the Rights modal stable while saving", async () => {
  const preset = departmentPermissionPresets.find((item) => item.id === "sales-manager")!
  let users = [{ ...makeUser(3), rights: [...preset.rights] }]
  let savedRole = ""
  let finishSave: (() => void) | undefined
  const saveGate = new Promise<void>((resolve) => {
    finishSave = resolve
  })

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      return success({
        users,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      })
    }
    if (url.pathname === `/api/users/${users[0].userId}/rights` && init?.method === "PUT") {
      const body = JSON.parse(String(init.body))
      await saveGate
      savedRole = body.role
      users = [{ ...users[0], rights: body.rights, role: body.role }]
      return success({ user: users[0] })
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

  expect(await screen.findByRole("row", { name: "User3 Account", exact: true })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Rights for User3 Account" }))
  const dialog = screen.getByRole("dialog", { name: /Rights — User3 Account/ })
  const presetSelect = within(dialog).getByLabelText("Permission preset configuration")
  expect(presetSelect).toHaveValue("sales-manager")

  await user.click(within(dialog).getByRole("switch", { name: "Add Employee" }))
  expect(presetSelect).toHaveValue("")
  await user.selectOptions(presetSelect, "sales-manager")
  await user.click(within(dialog).getByRole("button", { name: "Save Rights" }))

  expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled()
  expect(presetSelect).toHaveValue("sales-manager")
  expect(presetSelect).toBeDisabled()
  expect(dialog).toBeInTheDocument()

  finishSave?.()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(savedRole).toBe("admin")
  const updatedRow = within(screen.getByRole("row", { name: /User3 Account/ }))
  expect(updatedRow.getByText("Manager (Admin)")).toBeInTheDocument()
  await user.click(updatedRow.getByRole("button", { name: "Expand details for User3 Account" }))
  expect(within(screen.getByRole("region", { name: "Details for User3 Account" })).getByText("Sales & CRM — Manager")).toBeInTheDocument()
})

test("keeps the edited rights open when saving fails", async () => {
  const users = [makeUser(3)]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users" && (!init?.method || init.method === "GET")) {
      return success({
        users,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      })
    }
    if (url.pathname === `/api/users/${users[0].userId}/rights` && init?.method === "PUT") {
      return new Response(
        JSON.stringify({ success: false, error: { message: "Unable to save rights" } }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      )
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

  expect(await screen.findByRole("row", { name: "User3 Account", exact: true })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Rights for User3 Account" }))
  const dialog = screen.getByRole("dialog", { name: /Rights — User3 Account/ })
  const presetSelect = within(dialog).getByLabelText("Permission preset configuration")
  await user.selectOptions(presetSelect, "inventory-employee")
  await user.click(within(dialog).getByRole("button", { name: "Save Rights" }))

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Unable to save rights")
  expect(presetSelect).toHaveValue("inventory-employee")
  expect(within(dialog).getByRole("button", { name: "Save Rights" })).toBeEnabled()
})

test("displays Audit Logs tab for superadmin and toggles to AuditLogViewer", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/auth/session") return success({ user: superAdminSession })
    if (url.pathname === "/api/users/options") return success({ availableEmployees: [] })
    if (url.pathname === "/api/users") return success({ users: [makeUser(1, "employee")], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    if (url.pathname === "/api/audit-logs") {
      return success({
        logs: [
          {
            auditId: "999",
            tableName: "sales",
            action: "UPDATE",
            recordKey: "SO-1234",
            oldValues: { total: 100 },
            newValues: { total: 200 },
            actionBy: "superadmin",
            actionAt: "2026-11-02T12:00:00Z",
          },
        ],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
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

  expect(await screen.findByRole("tab", { name: "Audit Logs" })).toBeInTheDocument()
  await user.click(screen.getByRole("tab", { name: "Audit Logs" }))

  expect(await screen.findByText(/Append-Only Audit Log/i)).toBeInTheDocument()
  expect(await screen.findByText("SO-1234")).toBeInTheDocument()
})
