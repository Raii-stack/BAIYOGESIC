import type { Employee, JobHistoryEntry } from "../types/employee"
import { apiFailure } from "./api-errors"

type Row = {
  empno: string; firstname: string | null; lastname: string | null; email: string
  gender: "M" | "F" | null; birthdate: string | null; hiredate: string | null
  sepdate: string | null; is_deleted: boolean; stamp: string | null
  jobcode: string | null; deptcode: string | null; effdate: string | null
  jobdesc: string | null; deptname: string | null; salary: string | null
}
type HistoryRow = { empno: string; jobcode: string; deptcode: string | null; effdate: string; jobdesc: string | null; deptname: string | null; salary: string | null; stamp: string | null }
export type EmployeePagination = { page: number; limit: number; total: number; totalPages: number }
export type Lookup = { code: string; name: string }
export type JobRecord = { code: string; description: string; archived: boolean; stamp: string }
export type DepartmentRecord = { code: string; name: string; archived: boolean; stamp: string }
export type EmployeeInput = {
  firstname: string; lastname: string; email: string; gender: "M" | "F" | ""
  birthdate: string; hiredate: string; sepdate: string; jobcode: string; deptcode: string
  effdate: string; salary: number
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/employees${path}`, { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw apiFailure(0)
  }
  const result = await response.json().catch(() => null) as { success: boolean; data?: T; error?: { message?: string } } | null
  if (!response.ok || !result?.success || !result.data) throw apiFailure(response.status, result)
  return result.data
}

export function toEmployee(row: Row): Employee {
  return {
    id: row.empno, firstName: row.firstname || "", lastName: row.lastname || "",
    fullName: [row.firstname, row.lastname].filter(Boolean).join(" ") || row.empno,
    email: row.email, gender: row.gender, birthDate: row.birthdate || "",
    hireDate: row.hiredate || "", separationDate: row.sepdate,
    jobCode: row.jobcode || "", departmentCode: row.deptcode || "",
    effectiveDate: row.effdate || "", jobTitle: row.jobdesc || "Unassigned",
    department: row.deptname || "Unassigned", salary: row.salary == null ? 0 : Number(row.salary),
    canViewSalary: row.salary != null, archived: row.is_deleted, stamp: row.stamp || "",
  }
}

export const employeeApi = {
  async list(options: { page: number; limit: number; search: string; department: string; job: string; status: string }, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) })
    if (options.search) params.set("search", options.search)
    if (options.department) params.set("department", options.department)
    if (options.job) params.set("job", options.job)
    if (options.status !== "all") params.set("status", options.status)
    const data = await request<{ employees: Row[]; pagination: EmployeePagination }>(`?${params}`, "GET", undefined, signal)
    return { employees: data.employees.map(toEmployee), pagination: data.pagination }
  },
  options: (signal?: AbortSignal) => request<{ departments: Lookup[]; jobs: Lookup[] }>("/options", "GET", undefined, signal),
  async get(id: string, signal?: AbortSignal) {
    const data = await request<{ employee: Row; history: HistoryRow[] }>(`/${encodeURIComponent(id)}`, "GET", undefined, signal)
    return { employee: toEmployee(data.employee), history: data.history.map((row): JobHistoryEntry => ({
      id: `${row.empno}-${row.jobcode}-${row.effdate}`, effectiveDate: row.effdate,
      jobTitle: row.jobdesc || row.jobcode, department: row.deptname || row.deptcode || "—",
      salary: row.salary == null ? 0 : Number(row.salary), canViewSalary: row.salary != null, stamp: row.stamp || "",
    })) }
  },
  create: (input: EmployeeInput) => request<{ empno: string }>("", "POST", input),
  update: (id: string, input: EmployeeInput) => request<{ empno: string }>(`/${encodeURIComponent(id)}`, "PUT", input),
  archive: (id: string) => request<{ empno: string }>(`/${encodeURIComponent(id)}`, "DELETE"),
  restore: (id: string) => request<{ empno: string }>(`/${encodeURIComponent(id)}/restore`, "POST"),
  jobs: {
    async list(options: { page: number; limit: number; search: string; status: string }, signal?: AbortSignal) {
      const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) })
      if (options.search) params.set("search", options.search)
      if (options.status !== "all") params.set("status", options.status)
      const data = await request<{ jobs: { jobcode: string; jobdesc: string | null; is_deleted: boolean; stamp: string | null }[]; pagination: EmployeePagination }>(`/jobs?${params}`, "GET", undefined, signal)
      return {
        jobs: data.jobs.map((row): JobRecord => ({ code: row.jobcode, description: row.jobdesc || "", archived: row.is_deleted, stamp: row.stamp || "" })),
        pagination: data.pagination,
      }
    },
    create: (input: { jobcode: string; jobdesc: string }) => request<{ job: object }>("/jobs", "POST", input),
    update: (code: string, input: { jobdesc: string }) => request<{ job: object }>(`/jobs/${encodeURIComponent(code)}`, "PUT", input),
    archive: (code: string) => request<{ job: object }>(`/jobs/${encodeURIComponent(code)}`, "DELETE"),
    restore: (code: string) => request<{ job: object }>(`/jobs/${encodeURIComponent(code)}/restore`, "POST"),
  },
  departments: {
    async list(options: { page: number; limit: number; search: string; status: string }, signal?: AbortSignal) {
      const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) })
      if (options.search) params.set("search", options.search)
      if (options.status !== "all") params.set("status", options.status)
      const data = await request<{ departments: { deptcode: string; deptname: string | null; is_deleted: boolean; stamp: string | null }[]; pagination: EmployeePagination }>(`/departments?${params}`, "GET", undefined, signal)
      return {
        departments: data.departments.map((row): DepartmentRecord => ({ code: row.deptcode, name: row.deptname || "", archived: row.is_deleted, stamp: row.stamp || "" })),
        pagination: data.pagination,
      }
    },
    create: (input: { deptcode: string; deptname: string }) => request<{ department: object }>("/departments", "POST", input),
    update: (code: string, input: { deptname: string }) => request<{ department: object }>(`/departments/${encodeURIComponent(code)}`, "PUT", input),
    archive: (code: string) => request<{ department: object }>(`/departments/${encodeURIComponent(code)}`, "DELETE"),
    restore: (code: string) => request<{ department: object }>(`/departments/${encodeURIComponent(code)}/restore`, "POST"),
  },
}
