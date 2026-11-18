import { afterEach, describe, expect, test, vi } from "vitest"
import { employeeApi, toEmployee } from "./employee-api"

afterEach(() => vi.unstubAllGlobals())

describe("lib/employee-api ([S3-DEV-05])", () => {
  test("toEmployee maps redacted salary, unassigned titles, and linked account status", () => {
    const masked = toEmployee({
      empno: "00012",
      firstname: "Jane",
      lastname: "Reyes",
      email: "jane@hope.inc",
      gender: "F",
      birthdate: null,
      hiredate: "2024-01-15",
      sepdate: "2026-10-25",
      is_deleted: true,
      stamp: "DEL admin",
      jobcode: null,
      deptcode: null,
      effdate: null,
      jobdesc: null,
      deptname: null,
      salary: null,
      user_status: "disabled",
      user_is_blocked: true,
    })

    expect(masked).toMatchObject({
      id: "00012",
      fullName: "Jane Reyes",
      jobTitle: "Unassigned",
      department: "Unassigned",
      salary: 0,
      canViewSalary: false,
      archived: true,
      separationDate: "2026-10-25",
      userStatus: "disabled",
      isBlocked: true,
    })

    const unmasked = toEmployee({
      empno: "00001",
      firstname: null,
      lastname: null,
      email: "mgr@hope.inc",
      gender: null,
      birthdate: "1990-01-01",
      hiredate: "2020-01-01",
      sepdate: null,
      is_deleted: false,
      stamp: null,
      jobcode: "MGR",
      deptcode: "HRD",
      effdate: "2025-05-01",
      jobdesc: "HR Manager",
      deptname: "Human Resources",
      salary: "85000.50",
    })

    expect(unmasked).toMatchObject({
      fullName: "00001",
      salary: 85000.5,
      canViewSalary: true,
      archived: false,
      isBlocked: false,
    })
  })

  test("list and get map filters, career timeline history, and redacted history salaries", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              employees: [],
              pagination: { page: 2, limit: 10, total: 15, totalPages: 2 },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              employee: {
                empno: "00005",
                firstname: "Alex",
                lastname: "Cruz",
                email: "alex@hope.inc",
                gender: "M",
                birthdate: null,
                hiredate: "2022-03-01",
                sepdate: null,
                is_deleted: false,
                stamp: "ADD",
                jobcode: "DEV",
                deptcode: "IT",
                effdate: "2025-01-01",
                jobdesc: "Developer",
                deptname: "IT",
                salary: null,
              },
              history: [
                {
                  empno: "00005",
                  jobcode: "DEV",
                  deptcode: "IT",
                  effdate: "2025-01-01",
                  jobdesc: null,
                  deptname: null,
                  salary: null,
                  stamp: null,
                },
              ],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
    vi.stubGlobal("fetch", fetchSpy)

    await employeeApi.list({ page: 2, limit: 10, search: "Cruz", department: "IT", job: "DEV", status: "active" })
    expect(fetchSpy.mock.calls[0][0]).toContain(
      "/api/employees?page=2&limit=10&search=Cruz&department=IT&job=DEV&status=active",
    )

    const detail = await employeeApi.get("00005")
    expect(detail.history[0]).toEqual({
      id: "00005-DEV-2025-01-01",
      effectiveDate: "2025-01-01",
      jobTitle: "DEV",
      department: "IT",
      salary: 0,
      canViewSalary: false,
      stamp: "",
    })
  })

  test("archive includes separation_date and successful mutations emit change events", async () => {
    const noticeListener = vi.fn()
    const authListener = vi.fn()
    window.addEventListener("hope:notifications-changed", noticeListener)
    window.addEventListener("hope:authorization-changed", authListener)

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { empno: "00005", sepdate: "2026-11-18" } }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { empno: "00005" } }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, error: { message: "Cannot archive employee with active sales" } }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
    vi.stubGlobal("fetch", fetchSpy)

    try {
      await employeeApi.archive("00005", "2026-11-18")
      expect(fetchSpy.mock.calls[0][1]).toMatchObject({
        method: "DELETE",
        body: JSON.stringify({ separation_date: "2026-11-18" }),
      })

      await employeeApi.restore("00005")
      expect(fetchSpy.mock.calls[1][0]).toContain("/api/employees/00005/restore")

      await expect(employeeApi.archive("00005")).rejects.toThrow("Cannot archive employee with active sales")
      expect(noticeListener).toHaveBeenCalledTimes(2)
      expect(authListener).toHaveBeenCalledTimes(2)
    } finally {
      window.removeEventListener("hope:notifications-changed", noticeListener)
      window.removeEventListener("hope:authorization-changed", authListener)
    }
  })
})
