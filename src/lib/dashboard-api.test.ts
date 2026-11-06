import { describe, expect, test, vi, beforeEach } from "vitest"
import {
  formatCurrencyStat,
  formatIntegerStat,
  getDashboardStats,
  getCachedDashboardStats,
  clearDashboardStats,
} from "./dashboard-api"

describe("dashboard-api client and helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearDashboardStats()
  })

  test("formatCurrencyStat formats currency compactly", () => {
    expect(formatCurrencyStat(84200)).toBe("$84.2k")
    expect(formatCurrencyStat(1248)).toBe("$1.2k")
    expect(formatCurrencyStat(0)).toBe("$0")
    expect(formatCurrencyStat(500)).toBe("$500")
    expect(formatCurrencyStat(1500000)).toBe("$1.5m")
    expect(formatCurrencyStat(999950)).toBe("$1m")
    expect(formatCurrencyStat(999999)).toBe("$1m")
    expect(formatCurrencyStat(-1200)).toBe("-$1.2k")
    expect(formatCurrencyStat(-5000000)).toBe("-$5m")
    expect(formatCurrencyStat(Number.NaN)).toBe("$0")
  })

  test("formatIntegerStat formats numbers with thousands separators", () => {
    expect(formatIntegerStat(1248)).toBe("1,248")
    expect(formatIntegerStat(386)).toBe("386")
    expect(formatIntegerStat(94)).toBe("94")
    expect(formatIntegerStat(0)).toBe("0")
    expect(formatIntegerStat(Number.NaN)).toBe("0")
  })

  test("getDashboardStats fetches and returns stats from API", async () => {
    const mockStats = {
      customers: 1248,
      products: 386,
      openOrders: 94,
      revenue: 84200.5
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockStats
      })
    } as Response)

    const stats = await getDashboardStats()
    expect(stats).toEqual(mockStats)
  })

  test("getDashboardStats supports ?refresh=true option", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { customers: 10, products: 20, openOrders: 5, revenue: 100 }
      })
    } as Response)

    await getDashboardStats({ refresh: true })
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/dashboard/stats?refresh=true")
  })

  test("reuses metrics until refresh or session reset", async () => {
    const data = { customers: 10, products: 20, openOrders: 5, revenue: 100 }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, data })))
    await getDashboardStats()
    expect(getCachedDashboardStats()).toEqual(data)
    await getDashboardStats()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await getDashboardStats({ refresh: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    clearDashboardStats()
    expect(getCachedDashboardStats()).toBeNull()
    await getDashboardStats()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  test("a request from a previous session cannot repopulate the cache", async () => {
    let resolve!: (response: Response) => void
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((done) => { resolve = done }))
    const pending = getDashboardStats()
    clearDashboardStats()
    resolve(new Response(JSON.stringify({ success: true, data: { customers: 10 } })))
    await pending
    expect(getCachedDashboardStats()).toBeNull()
  })

  test("getDashboardStats throws on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { message: "Internal server error" }
      })
    } as Response)

    await expect(getDashboardStats()).rejects.toThrow()
  })
})
