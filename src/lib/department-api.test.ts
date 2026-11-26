import { afterEach, describe, expect, test, vi } from "vitest"
import { departmentApi, toDepartment } from "./department-api"

afterEach(() => vi.unstubAllGlobals())

describe("lib/department-api ([S3-DEV-01])", () => {
  test("toDepartment normalizes snake_case and camelCase employee counts", () => {
    expect(
      toDepartment({
        deptcode: "HRD",
        deptname: "Human Resources",
        employee_count: 14,
        is_deleted: false,
        stamp: "CREATED admin",
      }),
    ).toEqual({
      code: "HRD",
      name: "Human Resources",
      employeeCount: 14,
      archived: false,
      stamp: "CREATED admin",
    })

    expect(
      toDepartment({
        deptcode: "FIN",
        deptname: "",
        employeeCount: 3,
        is_deleted: true,
        stamp: "",
      }),
    ).toEqual({
      code: "FIN",
      name: "",
      employeeCount: 3,
      archived: true,
      stamp: "",
    })
  })

  test("list serializes search and non-all status filters cleanly", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            departments: [{ deptcode: "SLS", deptname: "Sales", employee_count: 8, is_deleted: false, stamp: "ADD" }],
            pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchSpy)

    const result = await departmentApi.list({ page: 1, limit: 25, search: "Sales", status: "active" })
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/departments?page=1&limit=25&search=Sales&status=active")
    expect(result.departments[0]).toMatchObject({ code: "SLS", name: "Sales", employeeCount: 8 })
  })

  test("encodes department codes for update, archive, restore and rethrows aborted requests", async () => {
    const fetchSpy = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({ success: true, data: { department: { deptcode: "R&D", deptname: "Research", is_deleted: false, stamp: "UPD" } } }),
        { headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchSpy)

    await departmentApi.update("R&D", { deptname: "Research & Dev" })
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/departments/R%26D")
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: "PUT", credentials: "include" })

    await departmentApi.archive("R&D")
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/departments/R%26D")
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ method: "DELETE" })

    await departmentApi.restore("R&D")
    expect(fetchSpy.mock.calls[2][0]).toContain("/api/departments/R%26D/restore")
    expect(fetchSpy.mock.calls[2][1]).toMatchObject({ method: "POST" })

    const controller = new AbortController()
    controller.abort()
    const abortErr = new DOMException("Aborted", "AbortError")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr))
    await expect(departmentApi.list({ page: 1, limit: 10 }, controller.signal)).rejects.toThrow("Aborted")
  })

  test("preserves 409 conflict messages when archiving departments with active employees", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, error: { message: "Cannot archive department while active employees are assigned." } }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    )

    await expect(departmentApi.archive("IT")).rejects.toThrow("Cannot archive department while active employees are assigned.")
  })
})
