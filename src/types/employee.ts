export type Employee = {
  id: string
  fullName: string
  department: string
  jobTitle: string
  birthDate?: string
  hireDate: string
  separationDate: string | null
  salary: number
  canViewSalary: boolean
  stamp: string
  firstName?: string
  lastName?: string
  email?: string
  gender?: "M" | "F" | null
  jobCode?: string
  departmentCode?: string
  effectiveDate?: string
  archived?: boolean
}

export type JobHistoryEntry = {
  id: string
  effectiveDate: string
  jobTitle: string
  department: string
  salary: number
  stamp: string
  canViewSalary?: boolean
}
