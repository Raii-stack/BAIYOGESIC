import { isAdminRole, type AuthUser } from "./auth"
import type { ReportName } from "../components/reports/ReportTable"

export type ErpModuleKey =
  | "customers"
  | "products"
  | "hr"
  | "sales"
  | "reports"
  | "users"

const MODULE_RIGHTS: Record<Exclude<ErpModuleKey, "users">, string[]> = {
  customers: [
    "customers.access",
    "customers.add",
    "customers.edit",
    "customers.delete",
  ],
  products: [
    "products.access",
    "products.add",
    "products.edit",
    "products.delete",
    "products.price.add",
    "products.price.edit",
    "products.price.delete",
  ],
  hr: [
    "hr.access",
    "hr.job.add",
    "hr.job.edit",
    "hr.job.delete",
    "hr.department.add",
    "hr.department.edit",
    "hr.department.delete",
    "hr.employee.add",
    "hr.employee.edit",
    "hr.employee.delete",
    "hr.history.view",
    "hr.history.add",
    "hr.history.edit",
    "hr.history.delete",
  ],
  sales: [
    "sales.access",
    "sales.add",
    "sales.edit",
    "sales.delete",
    "sales.details.view",
    "sales.details.add",
    "sales.details.edit",
    "sales.details.delete",
  ],
  reports: [
    "reports.access",
    "reports.top-customers",
    "reports.product-master",
    "reports.top-products",
    "reports.active-employees",
    "reports.all-employees",
    "reports.job-history",
    "reports.top-sales",
  ],
}

const LEGACY_EMPLOYEE_DEFAULT_RIGHTS = new Set([
  "customers.access",
  "products.access",
  "hr.access",
  "hr.history.view",
  "sales.access",
  "sales.details.view",
  "reports.access",
  "reports.top-customers",
  "reports.product-master",
  "reports.top-products",
  "reports.active-employees",
  "reports.all-employees",
  "reports.job-history",
  "reports.top-sales",
])

export function hasRight(user: AuthUser | null | undefined, rightCode: string): boolean {
  if (!user) return false

  if (isAdminRole(user.role)) {
    if (Array.isArray(user.rights) && user.rights.length > 0) {
      return user.rights.includes(rightCode)
    }
    return true
  }

  if (Array.isArray(user.rights)) {
    return user.rights.includes(rightCode)
  }

  return LEGACY_EMPLOYEE_DEFAULT_RIGHTS.has(rightCode)
}

export function hasAnyRight(user: AuthUser | null | undefined, rightCodes: string[]): boolean {
  return rightCodes.some((code) => hasRight(user, code))
}

export function canAccessModule(
  user: AuthUser | null | undefined,
  moduleKey: ErpModuleKey,
): boolean {
  if (!user) return false
  if (moduleKey === "users") {
    return isAdminRole(user.role)
  }
  return hasAnyRight(user, MODULE_RIGHTS[moduleKey])
}

export const REPORT_RIGHT_MAP: Record<ReportName, string> = {
  "Top Customers": "reports.top-customers",
  "Product Master List": "reports.product-master",
  "Top Products": "reports.top-products",
  "Active Employees": "reports.active-employees",
  "All Employees": "reports.all-employees",
  "Employee Job History": "reports.job-history",
  "Top Sales": "reports.top-sales",
}

export function getAllowedReports(
  user: AuthUser | null | undefined,
  allReports: ReportName[],
): ReportName[] {
  return allReports.filter((report) => hasRight(user, REPORT_RIGHT_MAP[report]))
}

export function getCustomerPermissions(user: AuthUser | null | undefined) {
  const canAdd = hasRight(user, "customers.add")
  const canEdit = hasRight(user, "customers.edit")
  const canDelete = hasRight(user, "customers.delete")
  const canViewAudit = isAdminRole(user?.role) || canDelete
  return { canAdd, canEdit, canDelete, canViewAudit }
}

export function getProductPermissions(user: AuthUser | null | undefined) {
  const canAdd = hasRight(user, "products.add")
  const canEdit = hasAnyRight(user, [
    "products.edit",
    "products.price.add",
    "products.price.edit",
  ])
  const canDelete = hasAnyRight(user, ["products.delete", "products.price.delete"])
  const canViewAudit = isAdminRole(user?.role) || canDelete
  return { canAdd, canEdit, canDelete, canViewAudit }
}

export function getHrPermissions(user: AuthUser | null | undefined) {
  const canAddEmployee = hasRight(user, "hr.employee.add")
  const canEditEmployee = hasRight(user, "hr.employee.edit")
  const canDeleteEmployee = hasRight(user, "hr.employee.delete")
  const canViewHistory = hasAnyRight(user, [
    "hr.history.view",
    "hr.history.add",
    "hr.history.edit",
    "hr.history.delete",
  ])
  const canAddJob = hasRight(user, "hr.job.add")
  const canEditJob = hasRight(user, "hr.job.edit")
  const canDeleteJob = hasRight(user, "hr.job.delete")
  const canAddDepartment = hasRight(user, "hr.department.add")
  const canEditDepartment = hasRight(user, "hr.department.edit")
  const canDeleteDepartment = hasRight(user, "hr.department.delete")
  const canViewAudit =
    isAdminRole(user?.role) ||
    canDeleteEmployee ||
    canDeleteJob ||
    canDeleteDepartment

  return {
    canAddEmployee,
    canEditEmployee,
    canDeleteEmployee,
    canViewHistory,
    canAddJob,
    canEditJob,
    canDeleteJob,
    canAddDepartment,
    canEditDepartment,
    canDeleteDepartment,
    canViewAudit,
  }
}

export function getSalesPermissions(user: AuthUser | null | undefined) {
  const canAddSale = hasRight(user, "sales.add")
  const canEditSale = hasRight(user, "sales.edit")
  const canDeleteSale = hasRight(user, "sales.delete")
  const canViewDetails = hasAnyRight(user, [
    "sales.details.view",
    "sales.details.add",
    "sales.details.edit",
    "sales.details.delete",
  ])
  const canAddDetail = hasRight(user, "sales.details.add")
  const canEditDetail = hasRight(user, "sales.details.edit")
  const canDeleteDetail = hasRight(user, "sales.details.delete")
  const canViewAudit = isAdminRole(user?.role) || canDeleteSale

  return {
    canAddSale,
    canEditSale,
    canDeleteSale,
    canViewDetails,
    canAddDetail,
    canEditDetail,
    canDeleteDetail,
    canViewAudit,
  }
}
