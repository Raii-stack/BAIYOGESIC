import { apiFailure } from "./api-errors"

export type DashboardStats = {
  customers: number
  products: number
  openOrders: number
  revenue: number
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message?: string }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

export async function getDashboardStats(options?: {
  signal?: AbortSignal
  refresh?: boolean
}): Promise<DashboardStats> {
  const query = options?.refresh ? "?refresh=true" : ""
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/dashboard/stats${query}`, {
      method: "GET",
      credentials: "include",
      signal: options?.signal,
    })
  } catch (error) {
    if (options?.signal?.aborted) throw error
    throw apiFailure(0)
  }

  const result = (await response.json().catch(() => null)) as
    | (ApiResponse<DashboardStats> & Partial<DashboardStats>)
    | null

  if (!response.ok) {
    throw apiFailure(response.status, result)
  }

  const payload = result?.data || result

  return {
    customers: Number(payload?.customers) || 0,
    products: Number(payload?.products) || 0,
    openOrders: Number(payload?.openOrders ?? (payload as { open_orders?: number })?.open_orders) || 0,
    revenue: Number(payload?.revenue) || 0,
  }
}

export function formatIntegerStat(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatCurrencyStat(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
    .format(amount)
    .toLowerCase()
}
