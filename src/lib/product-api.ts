import type { PriceHistoryEntry, Product, UnitType } from "../types/product"
import { apiFailure } from "./api-errors"

type ProductRow = {
  prodcode: string
  description: string
  unit: UnitType
  unitprice: string | number | null
  effdate: string | null
  is_deleted: boolean
  stamp: string
}

type PriceRow = { effdate: string; unitprice: string | number; stamp: string }

export type ProductInput = { description: string; unit: UnitType; unitprice: number }
export type ProductPagination = { page: number; limit: number; total: number; totalPages: number }

type ApiResponse<T> = { success: boolean; data?: T; error?: { message?: string } }
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/products${path}`, {
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

function toProduct(row: ProductRow): Product {
  return {
    code: row.prodcode,
    description: row.description,
    unitType: row.unit,
    currentPrice: row.unitprice === null ? null : Number(row.unitprice),
    priceEffectiveDate: row.effdate,
    status: row.is_deleted ? "Inactive" : "Active",
    stamp: row.stamp,
  }
}

export const productApi = {
  async list(options: { page: number; limit: number; search: string; unit: UnitType | ""; status: "all" | "active" | "archived" }, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) })
    if (options.search) params.set("search", options.search)
    if (options.unit) params.set("unit", options.unit)
    if (options.status !== "all") params.set("status", options.status)
    const data = await request<{ products: ProductRow[]; pagination: ProductPagination }>(`?${params}`, "GET", undefined, signal)
    return { products: data.products.map(toProduct), pagination: data.pagination }
  },
  async priceHistory(code: string, signal?: AbortSignal): Promise<PriceHistoryEntry[]> {
    const data = await request<{ prices: PriceRow[] }>(`/${encodeURIComponent(code)}/prices`, "GET", undefined, signal)
    return data.prices.map((row) => ({ effectiveDate: row.effdate, price: Number(row.unitprice), stamp: row.stamp }))
  },
  create: (input: ProductInput) => request<{ product: ProductRow }>("", "POST", input),
  update: (code: string, input: ProductInput) => request<{ product: ProductRow }>(`/${encodeURIComponent(code)}`, "PUT", input),
  archive: (code: string) => request<{ product: ProductRow }>(`/${encodeURIComponent(code)}`, "DELETE"),
  restore: (code: string) => request<{ product: ProductRow }>(`/${encodeURIComponent(code)}/restore`, "POST"),
}
