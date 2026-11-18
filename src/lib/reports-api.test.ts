import { afterEach, describe, expect, test, vi } from "vitest"
import { reportsApi, type ReportName } from "./reports-api"

afterEach(() => vi.unstubAllGlobals())

describe("lib/reports-api ([S4-DEV-04 & S4-DEV-05])", () => {
  test.each<[ReportName, string]>([
    ["Top Customers", "top-customers"],
    ["Product Master List", "product-master"],
    ["Top Products", "top-products"],
    ["Active Employees", "active-employees"],
    ["All Employees", "all-employees"],
    ["Employee Job History", "job-history"],
    ["Top Sales", "top-sales"],
  ])("maps report %s to endpoint /api/reports/%s", async (reportName, slug) => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { report: slug, rows: [{ rank: 1 }] } }), {
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchSpy)

    const result = await reportsApi.get(reportName)
    expect(fetchSpy.mock.calls[0][0]).toContain(`/api/reports/${slug}`)
    expect(result.rows).toEqual([{ rank: 1 }])
  })

  test("serializes startDate, endDate, limit, and empno filters cleanly", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { report: "job-history", rows: [], employees: [{ empno: "00001", fullname: "Jane Reyes" }] },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchSpy)

    const result = await reportsApi.get("Employee Job History", {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      limit: 25,
      empno: "00001",
    })
    expect(fetchSpy.mock.calls[0][0]).toContain(
      "/api/reports/job-history?startDate=2026-01-01&endDate=2026-12-31&limit=25&empno=00001",
    )
    expect(result.employees).toEqual([{ empno: "00001", fullname: "Jane Reyes" }])
  })

  test("rejects malformed non-array rows payloads and rethrows AbortError without fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { report: "top-sales", rows: "invalid" } }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    await expect(reportsApi.get("Top Sales")).rejects.toThrow()

    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")))
    await expect(reportsApi.get("Top Customers", {}, controller.signal)).rejects.toThrow("Cancelled")
  })
})
