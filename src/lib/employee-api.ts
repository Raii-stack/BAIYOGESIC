import type { Employee, JobHistoryEntry } from "../types/employee"

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
    throw new Error("Unable to reach the employee service. Please try again.")
  }
  const result = await response.json().catch(() => null) as { success: boolean; data?: T; error?: { message?: string } } | null
  if (!response.ok || !result?.success || !result.data) throw new Error(result?.error?.message || "Unable to load employee records.")
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
}
