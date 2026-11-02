import { describe, expect, test } from "vitest"
import { canViewSalary, getHrPermissions, hasActionRight, setActiveRbacUser } from "./rbac"
import type { AuthUser } from "./auth"

const superadmin: AuthUser = {
  userId: "1",
  empno: "00001",
  email: "superadmin@example.com",
  role: "superadmin",
  status: "active",
  mustChangePassword: false,
  rights: [],
}

const admin: AuthUser = {
  userId: "2",
  empno: "00002",
  email: "admin@example.com",
  role: "admin",
  status: "active",
  mustChangePassword: false,
  rights: [],
}

const hrManager: AuthUser = {
  userId: "3",
  empno: "00003",
  email: "manager@example.com",
  role: "hr_manager",
  status: "active",
  mustChangePassword: false,
  rights: ["hr.access"],
}

const employeeWithSalaryRight: AuthUser = {
  userId: "4",
  empno: "00004",
  email: "specialist@example.com",
  role: "employee",
  status: "active",
  mustChangePassword: false,
  rights: ["hr.access", "hr.salary"],
}

const standardEmployee: AuthUser = {
  userId: "5",
  empno: "00005",
  email: "staff@example.com",
  role: "employee",
  status: "active",
  mustChangePassword: false,
  rights: ["hr.access", "hr.history.view"],
}

describe("RBAC hasActionRight & canViewSalary", () => {
  test("allows superadmins and administrators to view salary", () => {
    expect(hasActionRight(superadmin, "Human Resources", "View Salary")).toBe(true)
    expect(canViewSalary(superadmin)).toBe(true)
    expect(getHrPermissions(superadmin).canViewSalary).toBe(true)
  })

  test("allows administrators and admins to view salary", () => {
    expect(hasActionRight(admin, "Human Resources", "View Salary")).toBe(true)
    expect(canViewSalary(admin)).toBe(true)
    expect(getHrPermissions(admin).canViewSalary).toBe(true)
  })

  test("allows HR managers to view salary", () => {
    expect(hasActionRight(hrManager, "Human Resources", "View Salary")).toBe(true)
    expect(canViewSalary(hrManager)).toBe(true)
    expect(getHrPermissions(hrManager).canViewSalary).toBe(true)
  })

  test("allows employees with specific salary rights to view salary", () => {
    expect(hasActionRight(employeeWithSalaryRight, "Human Resources", "View Salary")).toBe(true)
    expect(canViewSalary(employeeWithSalaryRight)).toBe(true)
    expect(getHrPermissions(employeeWithSalaryRight).canViewSalary).toBe(true)
  })

  test("denies salary viewing for standard employees without salary rights", () => {
    expect(hasActionRight(standardEmployee, "Human Resources", "View Salary")).toBe(false)
    expect(canViewSalary(standardEmployee)).toBe(false)
    expect(getHrPermissions(standardEmployee).canViewSalary).toBe(false)
  })

  test("supports hasActionRight invocation with active user context", () => {
    setActiveRbacUser(admin)
    expect(hasActionRight("Human Resources", "View Salary")).toBe(true)

    setActiveRbacUser(standardEmployee)
    expect(hasActionRight("Human Resources", "View Salary")).toBe(false)
  })
})
