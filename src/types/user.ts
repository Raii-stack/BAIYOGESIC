export type UserRole = "superadmin" | "admin" | "employee"
export type AccountStatus = "active" | "pending" | "disabled"

export type SystemUser = {
  userId: string
  empno: string | null
  firstName: string
  lastName: string
  name: string
  email: string
  role: UserRole
  status: AccountStatus
  isBlocked: boolean
  mustChangePassword: boolean
  jobTitle: string | null
  departmentName: string | null
  stamp: string | null
  rights: string[]
}

export type AvailableEmployee = {
  empno: string
  firstName: string
  lastName: string
  name: string
  email: string
  jobTitle: string | null
  departmentName: string | null
}

export type PermissionGroup = {
  module: string
  accessRight: string
  employeeDefaultIds: string[]
  viewerIds: string[]
  permissions: {
    id: string
    label: string
  }[]
}

export type DepartmentPermissionPreset = {
  id: string
  department: string
  level: "Manager" | "Employee"
  label: string
  description: string
  rights: string[]
}
