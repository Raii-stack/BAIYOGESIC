import { apiFailure } from "./api-errors"

export type DepartmentRow = {
  deptcode: string
  deptname: string
  is_deleted: boolean
  stamp: string
  employee_count?: number
  employeeCount?: number
}

export type Department = {
  code: string
  name: string
  employeeCount: number
  archived: boolean
  stamp: string
}

export type DepartmentPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type DepartmentInput = {
  deptcode: string
  deptname: string
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message?: string }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/departments${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw apiFailure(0)
  }

  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) {
    throw apiFailure(response.status, result)
  }
  return result.data
}

export function toDepartment(row: DepartmentRow): Department {
  return {
    code: row.deptcode,
    name: row.deptname || "",
    employeeCount: Number(row.employee_count ?? row.employeeCount ?? 0),
    archived: Boolean(row.is_deleted),
    stamp: row.stamp || "",
  }
}

export const departmentApi = {
  async list(
    options: {
      page: number
      limit: number
      search?: string
      status?: "all" | "active" | "archived"
    },
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      page: String(options.page),
      limit: String(options.limit),
    })
    if (options.search) params.set("search", options.search)
    if (options.status && options.status !== "all") params.set("status", options.status)
    const data = await request<{ departments: DepartmentRow[]; pagination: DepartmentPagination }>(
      `?${params}`,
      "GET",
      undefined,
      signal,
    )
    return {
      departments: data.departments.map(toDepartment),
      pagination: data.pagination,
    }
  },
  create: (input: DepartmentInput) =>
    request<{ department: DepartmentRow }>("", "POST", input),
  update: (code: string, input: { deptname: string }) =>
    request<{ department: DepartmentRow }>(`/${encodeURIComponent(code)}`, "PUT", input),
  archive: (code: string) =>
    request<{ department: DepartmentRow }>(`/${encodeURIComponent(code)}`, "DELETE"),
  restore: (code: string) =>
    request<{ department: DepartmentRow }>(`/${encodeURIComponent(code)}/restore`, "POST"),
}
