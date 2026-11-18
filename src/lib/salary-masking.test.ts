import { describe, expect, test } from "vitest"
import type { AuthUser } from "./auth"
import {
  canAccessModule,
  canViewSalary,
  getCustomerPermissions,
  getHrPermissions,
  getProductPermissions,
  getSalesPermissions,
  hasActionRight,
  hasRight,
  setActiveRbacUser,
} from "./rbac"

const baseUser: AuthUser = {
  userId: "u-1",
  empno: "00010",
  email: "user@hope.inc",
  role: "employee",
  status: "active",
  mustChangePassword: false,
}

describe("lib/rbac salary redaction and IT admin isolation ([S3-UIX-03])", () => {
  test("it_admin cannot view HR salaries or non-user modules even with explicit HR rights", () => {
    const itAdmin: AuthUser = {
      ...baseUser,
      role: "it_admin",
      rights: ["hr.salary", "hr.view_salary", "hr.employee.edit", "hr.access", "sales.access"],
    }

    expect(canAccessModule(itAdmin, "users")).toBe(true)
    expect(canAccessModule(itAdmin, "hr")).toBe(false)
    expect(canAccessModule(itAdmin, "customers")).toBe(false)
    expect(canAccessModule(itAdmin, "sales")).toBe(false)
    expect(hasRight(itAdmin, "hr.salary")).toBe(false)
    expect(canViewSalary(itAdmin)).toBe(false)
    expect(getHrPermissions(itAdmin).canViewSalary).toBe(false)
  })

  test.each([
    "hr.salary",
    "hr.view_salary",
    "hr:salary:view",
    "hr:view_salary",
    "hr.salary.view",
    "hr.employee.edit",
    "hr.history.edit",
  ])("recognizes salary view alias %s regardless of module/action casing", (alias) => {
    const specialist: AuthUser = { ...baseUser, rights: [alias] }
    expect(canViewSalary(specialist)).toBe(true)
    expect(hasActionRight(specialist, "  Human Resources ", " view salary ")).toBe(true)
    expect(hasActionRight(specialist, "HR", "SALARY")).toBe(true)
  })

  test("supports legacy permissions array fallback on employee accounts", () => {
    const legacyUser = { ...baseUser, rights: undefined, permissions: ["hr:salary:view"] } as AuthUser & {
      permissions: string[]
    }
    expect(canViewSalary(legacyUser)).toBe(true)
  })

  test("handles null, undefined, and non-HR actions safely", () => {
    setActiveRbacUser(null)
    expect(canViewSalary(null)).toBe(false)
    expect(canViewSalary(undefined)).toBe(false)
    expect(hasActionRight("Human Resources", "View Salary")).toBe(false)
    expect(hasActionRight(baseUser, "CRM", "Export")).toBe(false)
    expect(getHrPermissions(null)).toMatchObject({
      canAddEmployee: false,
      canEditEmployee: false,
      canDeleteEmployee: false,
      canViewHistory: false,
      canViewSalary: false,
      canViewAudit: false,
    })
  })

  test("derives audit and restore visibility across Customer, Product, and Sales helpers", () => {
    const salesClerk: AuthUser = { ...baseUser, rights: ["sales.access", "sales.restore", "products.price.add"] }
    expect(getCustomerPermissions(salesClerk)).toEqual({ canAdd: false, canEdit: false, canDelete: false, canViewAudit: false })
    expect(getProductPermissions(salesClerk)).toMatchObject({ canEdit: true, canDelete: false, canViewAudit: false })
    expect(getSalesPermissions(salesClerk)).toMatchObject({ canRestoreSale: true, canViewAudit: false })
  })
})
