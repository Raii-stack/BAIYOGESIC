import type { Customer, PaymentTerm } from "../types/customer"
import { apiFailure } from "./api-errors"

type CustomerRow = {
  custno: string
  custname: string
  address: string
  payterm: PaymentTerm
  is_deleted: boolean
  stamp: string
}

export type CustomerPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type CustomerInput = {
  custname: string
  address: string
  payterm: PaymentTerm
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
    response = await fetch(`${apiBase}/api/customers${path}`, {
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

  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) {
    throw apiFailure(response.status, result)
  }
  return result.data
}

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.custno,
    company: row.custname,
    name: "",
    address: row.address,
    paymentTerm: row.payterm,
    status: row.is_deleted ? "Inactive" : "Active",
    stamp: row.stamp,
  }
}

export const customerApi = {
  async list(options: { page: number; limit: number; search: string; payterm: PaymentTerm | ""; status: "all" | "active" | "archived" }, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) })
    if (options.search) params.set("search", options.search)
    if (options.payterm) params.set("payterm", options.payterm)
    if (options.status !== "all") params.set("status", options.status)
    const data = await request<{ customers: CustomerRow[]; pagination: CustomerPagination }>(`?${params}`, "GET", undefined, signal)
    return { customers: data.customers.map(toCustomer), pagination: data.pagination }
  },
  create: (input: CustomerInput) => request<{ customer: CustomerRow }>("", "POST", input),
  update: (id: string, input: CustomerInput) => request<{ customer: CustomerRow }>(`/${encodeURIComponent(id)}`, "PUT", input),
  archive: (id: string) => request<{ customer: CustomerRow }>(`/${encodeURIComponent(id)}`, "DELETE"),
}
