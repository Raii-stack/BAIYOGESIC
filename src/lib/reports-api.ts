import { apiFailure } from "./api-errors"

export type ReportName = "Top Customers" | "Product Master List" | "Top Products" | "Active Employees" | "All Employees" | "Employee Job History" | "Top Sales"
export type ReportRow = Record<string, string | number | null>
export type ReportEmployee = { empno: string; fullname: string }

type ReportResult = {
  report: string
  rows: ReportRow[]
  employees?: ReportEmployee[]
}

type ApiResponse = {
  success: boolean
  data?: ReportResult
  error?: { message?: string }
}

const reportPaths: Record<ReportName, string> = {
  "Top Customers": "top-customers",
  "Product Master List": "product-master",
  "Top Products": "top-products",
  "Active Employees": "active-employees",
  "All Employees": "all-employees",
  "Employee Job History": "job-history",
  "Top Sales": "top-sales",
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

export const reportsApi = {
  async get(
    report: ReportName,
    filters: { startDate?: string; endDate?: string; limit?: number; empno?: string } = {},
    signal?: AbortSignal,
  ): Promise<ReportResult> {
    const params = new URLSearchParams()
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.limit !== undefined) params.set("limit", String(filters.limit))
    if (filters.empno) params.set("empno", filters.empno)

    let response: Response
    try {
      const query = params.size ? `?${params}` : ""
      response = await fetch(`${apiBase}/api/reports/${reportPaths[report]}${query}`, {
        credentials: "include",
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw apiFailure(0)
    }

    const result = (await response.json().catch(() => null)) as ApiResponse | null
    if (!response.ok || !result?.success || !result.data || !Array.isArray(result.data.rows)) {
      throw apiFailure(response.status, result)
    }
    return result.data
  },
}
