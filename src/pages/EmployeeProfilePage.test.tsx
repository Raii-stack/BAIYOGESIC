import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { useAuth } from "../components/auth/AuthProvider"
import { employeeApi } from "../lib/employee-api"
import EmployeeProfilePage from "./EmployeeProfilePage"

vi.mock("../components/auth/AuthProvider", () => ({ useAuth: vi.fn() }))
vi.mock("../lib/employee-api", () => ({ employeeApi: { get: vi.fn() } }))

const employee = {
  id: "00001",
  fullName: "Ana User",
  firstName: "Ana",
  lastName: "User",
  email: "ana@example.com",
  department: "Information Technology",
  jobTitle: "Developer",
  hireDate: "2022-01-01",
  separationDate: null,
  salary: 55000,
  canViewSalary: true,
  archived: false,
  stamp: "ADD admin",
}

const history = [
  { id: "00001-DEV-2026-01-01", effectiveDate: "2026-01-01", jobTitle: "Senior Developer", department: "Information Technology", salary: 65000, canViewSalary: true, stamp: "UPDATE admin" },
  { id: "00001-DEV-2022-01-01", effectiveDate: "2022-01-01", jobTitle: "Developer", department: "Information Technology", salary: 55000, canViewSalary: true, stamp: "ADD admin" },
]

const admin = { userId: "1", empno: "00001", email: "admin@example.com", role: "administrator", status: "active", mustChangePassword: false, rights: [] }
const employeeUser = { userId: "2", empno: "00002", email: "staff@example.com", role: "employee", status: "active", mustChangePassword: false, rights: [] }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  vi.mocked(employeeApi.get).mockResolvedValue({ employee, history })
})

function renderPage(user = admin) {
  vi.mocked(useAuth).mockReturnValue({ user, loading: false, login: vi.fn(), changePassword: vi.fn(), logout: vi.fn() })
  render(
    <MemoryRouter initialEntries={["/employees/00001"]}>
      <Routes>
        <Route path="/employees/:employeeId" element={<EmployeeProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test("loads employee details, history, audit data, and salary values for administrators", async () => {
  renderPage()
  expect(await screen.findByRole("heading", { name: "Ana User" })).toBeInTheDocument()
  expect(screen.getByRole("list", { name: "Job history timeline" })).toBeInTheDocument()
  expect(screen.getByText("Current")).toBeInTheDocument()
  expect(screen.getByText("Senior Developer")).toBeInTheDocument()
  expect(screen.getByText("$65,000")).toBeInTheDocument()
  expect(screen.getByText("UPDATE admin")).toBeInTheDocument()
  expect(employeeApi.get).toHaveBeenCalledWith("00001", expect.any(AbortSignal))
})

test("keeps salary redacted inside the timeline when the API withholds it", async () => {
  vi.mocked(employeeApi.get).mockResolvedValue({
    employee: { ...employee, salary: 0, canViewSalary: false },
    history: history.map((entry) => ({ ...entry, salary: 0, canViewSalary: false })),
  })
  renderPage()
  expect(await screen.findByRole("list", { name: "Job history timeline" })).toBeInTheDocument()
  expect(screen.getAllByLabelText("Salary hidden due to permissions")).toHaveLength(2)
  expect(screen.queryByText("$65,000")).not.toBeInTheDocument()
})

test("hides job history when the user lacks history rights", async () => {
  renderPage(employeeUser)
  expect(await screen.findByRole("heading", { name: "Ana User" })).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Job history" })).not.toBeInTheDocument()
  expect(screen.queryByText("$65,000")).not.toBeInTheDocument()
})

test("shows an empty-history state and retries a failed profile request", async () => {
  const user = userEvent.setup()
  vi.mocked(employeeApi.get)
    .mockRejectedValueOnce(new Error("Employee service unavailable."))
    .mockResolvedValueOnce({ employee, history: [] })
  renderPage()

  expect(await screen.findByRole("alert")).toHaveTextContent("Employee service unavailable.")
  await user.click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByText("No job history recorded.")).toBeInTheDocument()
  expect(employeeApi.get).toHaveBeenCalledTimes(2)
})

