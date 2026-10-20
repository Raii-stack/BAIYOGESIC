export type UserRole = "SUPERADMIN" | "ADMIN" | "USER"
export type UserStatus = "Active" | "Blocked"

export type SystemUser = {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  rights: string[]
}

export type PermissionGroup = {
  module: string
  permissions: {
    id: string
    label: string
  }[]
}
