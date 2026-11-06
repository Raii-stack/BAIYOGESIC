import type { PriceHistoryEntry, Product, UnitType } from "../types/product"
import { apiFailure } from "./api-errors"

type ProductRow = {
  prodcode: string
  description: string
  unit: UnitType
  unitprice?: string | number | null
  effdate?: string | null
  is_deleted: boolean
  stamp: string
}

type PriceRow = { effdate: string; unitprice: string | number; stamp: string }

export type ProductInput = { description: string; unit: UnitType; unitprice: number }
export type ProductPagination = { page: number; limit: number; total: number; totalPages: number }
export type ProductSortBy = "productCode" | "description" | "unitPrice"

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
  if (method !== "GET") window.dispatchEvent(new Event("hope:notifications-changed"))
  return result.data
}

export function toProduct(row: ProductRow): Product {
  const price = row.unitprice == null || row.unitprice === "" ? null : Number(row.unitprice)
  return {
    code: row.prodcode,
    description: row.description,
    unitType: row.unit,
    currentPrice: price !== null && Number.isFinite(price) ? price : null,
    priceEffectiveDate: row.effdate ?? null,
    status: row.is_deleted ? "Inactive" : "Active",
    stamp: row.stamp,
  }
}

export const productApi = {
  async list(options: { page: number; limit: number; search: string; unit: UnitType | ""; status: "all" | "active" | "archived"; sortBy: ProductSortBy; sortOrder: "asc" | "desc" }, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) })
    if (options.search) params.set("search", options.search)
    if (options.unit) params.set("unit", options.unit)
    if (options.status !== "all") params.set("status", options.status)
    params.set("sortBy", options.sortBy)
    params.set("sortOrder", options.sortOrder)
    const data = await request<{ products: ProductRow[]; pagination: ProductPagination }>(`?${params}`, "GET", undefined, signal)
    return { products: data.products.map(toProduct), pagination: data.pagination }
  },
  async priceHistory(code: string, signal?: AbortSignal): Promise<PriceHistoryEntry[]> {
    const data = await request<{ prices?: PriceRow[]; priceHistory?: PriceRow[] }>(`/${encodeURIComponent(code)}/prices`, "GET", undefined, signal)
    const list = data.prices || data.priceHistory || []
    return list.map((row) => ({ effectiveDate: row.effdate, price: Number(row.unitprice), stamp: row.stamp }))
  },
  addPriceHistory: (code: string, input: { effdate: string; price: number }) =>
    request<{ price: object }>(`/${encodeURIComponent(code)}/price-history`, "POST", input),
  create: (input: ProductInput) => request<{ product: ProductRow }>("", "POST", input),
  update: (code: string, input: ProductInput) => request<{ product: ProductRow }>(`/${encodeURIComponent(code)}`, "PUT", input),
  archive: (code: string) => request<{ product: ProductRow }>(`/${encodeURIComponent(code)}`, "DELETE"),
  restore: (code: string) => request<{ product: ProductRow }>(`/${encodeURIComponent(code)}/restore`, "POST"),
}
