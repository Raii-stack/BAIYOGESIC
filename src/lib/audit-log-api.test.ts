import { afterEach, describe, expect, test, vi } from "vitest"
import { auditLogApi } from "./audit-log-api"

afterEach(() => vi.unstubAllGlobals())

describe("lib/audit-log-api ([S4-DEV-08])", () => {
  test("list serializes active audit log filters cleanly", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            logs: [{ auditId: "42", tableName: "employee", action: "UPDATE", recordKey: "00001", actionBy: "admin", actionAt: "2026-11-02T00:00:00Z" }],
            pagination: { page: 2, limit: 25, total: 30, totalPages: 2 },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchSpy)

    const result = await auditLogApi.list({
      tableName: "employee",
      action: "UPDATE",
      username: "admin@hope.inc",
      startDate: "2026-11-01",
      endDate: "2026-11-18",
      page: 2,
      limit: 25,
    })

    expect(fetchSpy.mock.calls[0][0]).toContain(
      "/api/audit-logs?tableName=employee&action=UPDATE&username=admin%40hope.inc&startDate=2026-11-01&endDate=2026-11-18&page=2&limit=25",
    )
    expect(result.logs).toHaveLength(1)
    expect(result.pagination.totalPages).toBe(2)
  })

  test("get fetches URL-encoded entry and rejects missing log payload with 502 error", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              log: {
                auditId: "100",
                tableName: "sales",
                action: "INSERT",
                recordKey: "TR0001",
                oldValues: null,
                newValues: { custno: "C0001" },
                actionBy: "admin",
                actionAt: "2026-11-02T00:00:00Z",
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {} }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
    vi.stubGlobal("fetch", fetchSpy)

    const entry = await auditLogApi.get("100/bad")
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/audit-logs/100%2Fbad")
    expect(entry.auditId).toBe("100")

    await expect(auditLogApi.get("999")).rejects.toThrow()
  })

  test("rethrows AbortError without emitting fallback network error", async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")))
    await expect(auditLogApi.list({}, controller.signal)).rejects.toThrow("Aborted")
  })
})
