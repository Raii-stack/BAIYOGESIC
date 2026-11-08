import { cleanup, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, test, vi } from "vitest"
import EmployeeTable from "./EmployeeTable"
import type { Employee } from "../../types/employee"
import type { EmployeePagination } from "../../lib/employee-api"

afterEach(() => {
  cleanup()
})

const basePagination: EmployeePagination = {
  page: 1,
  limit: 10,
  total: 1,
  totalPages: 1,
}

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "00001",
    fullName: "Nelson Aguinaldo",
    department: "Information Tech",
    jobTitle: "Developer",
    hireDate: "2023-01-01",
    separationDate: null,
    salary: 50000,
    canViewSalary: true,
    stamp: "ADD admin",
    firstName: "Nelson",
    lastName: "Aguinaldo",
    email: "nelson@example.com",
    archived: false,
    userStatus: null,
    isBlocked: false,
    ...overrides,
  }
}

describe("EmployeeTable status badge rendering", () => {
  const defaultProps = {
    pagination: basePagination,
    loading: false,
    error: false,
    onPageChange: vi.fn(),
    onEdit: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    restoringId: null,
    canEdit: true,
    canDelete: true,
    canViewHistory: true,
    canViewAudit: true,
    canViewSalary: true,
  }

  test("renders 'Active' badge for standard active employee", () => {
    const employee = createEmployee()
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Active")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-emerald-100", "text-emerald-800")
  })

  test("renders 'Blocked' badge with red styling when user account is blocked", () => {
    const employee = createEmployee({ isBlocked: true, userStatus: "active" })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Blocked")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-red-100", "text-red-800")
    expect(row).toHaveClass("bg-red-50/40")
  })

  test("renders 'Disabled' badge when user account is disabled", () => {
    const employee = createEmployee({ userStatus: "disabled" })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Disabled")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-neutral-100", "text-neutral-600")
  })

  test("renders 'Rejected' badge when user account is rejected", () => {
    const employee = createEmployee({ userStatus: "rejected" })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Rejected")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-neutral-100", "text-neutral-600")
  })

  test("renders 'Pending' badge when user account is pending approval", () => {
    const employee = createEmployee({ userStatus: "pending" })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Pending")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-amber-100", "text-amber-900")
  })

  test("renders 'Separated' badge when employee has a separation date", () => {
    const employee = createEmployee({ separationDate: "2026-11-01" })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Separated")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-amber-100", "text-amber-900")
  })

  test("renders 'Archived' badge when employee is soft deleted / archived", () => {
    const employee = createEmployee({ archived: true })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    const badge = within(row).getByText("Archived")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-neutral-100", "text-neutral-600")
  })

  test("does not render email or salary lock icon below the first name", () => {
    const employee = createEmployee({
      firstName: "Nelson",
      lastName: "Aguinaldo",
      email: "nelson@example.com",
      canViewSalary: false,
    })
    render(
      <MemoryRouter>
        <EmployeeTable {...defaultProps} canViewSalary={false} employees={[employee]} />
      </MemoryRouter>,
    )

    const row = screen.getByRole("row", { name: /Nelson Aguinaldo/ })
    expect(within(row).getByRole("link", { name: /Nelson/ })).toBeInTheDocument()
    expect(within(row).queryByText("nelson@example.com")).not.toBeInTheDocument()
    expect(within(row).queryByLabelText("Salary hidden due to permissions")).not.toBeInTheDocument()
  })
})
