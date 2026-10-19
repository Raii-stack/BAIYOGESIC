export type Employee = {
  id: string
  fullName: string
  department: string
  jobTitle: string
  hireDate: string
  separationDate: string | null
  salary: number
  canViewSalary: boolean
}

export type JobHistoryEntry = {
  id: string
  effectiveDate: string
  jobTitle: string
  department: string
  salary: number
}
