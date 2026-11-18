import { afterEach, describe, expect, test, vi } from "vitest"
import { customerApi, toCustomer } from "./customer-api"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("customer-api client ([S2-DEV-02a])", () => {
  test("toCustomer normalizes backend customer rows", () => {
    expect(toCustomer({
      custno: "C0001",
      custname: "Northstar Office",
      address: "12 Market St",
      payterm: "60D",
      is_deleted: false,
      stamp: "ADD admin",
    })).toEqual({
      id: "C0001",
      company: "Northstar Office",
      name: "",
      address: "12 Market St",
      paymentTerm: "60D",
      status: "Active",
      stamp: "ADD admin",
    })

    expect(toCustomer({
      custno: "C0002",
      custname: "Archived Co",
      address: "99 Elm Rd",
      payterm: "COD",
      is_deleted: true,
      stamp: "DELETE admin",
    }).status).toBe("Inactive")
  })

  test("list serializes query filters and omits default all status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        data: {
          customers: [{ custno: "C0001", custname: "Acme", address: "1 Main", payterm: "30D", is_deleted: false, stamp: "" }],
          pagination: { page: 2, limit: 25, total: 1, totalPages: 1 },
        },
      }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await customerApi.list({
      page: 2,
      limit: 25,
      search: "Acme",
      payterm: "30D",
      status: "all",
      sortBy: "customer",
      sortOrder: "desc",
    })

    expect(result.customers).toHaveLength(1)
    expect(result.customers[0].id).toBe("C0001")
    const requestedUrl = String(fetchMock.mock.calls[0][0])
    expect(requestedUrl).toContain("page=2")
    expect(requestedUrl).toContain("search=Acme")
    expect(requestedUrl).toContain("payterm=30D")
    expect(requestedUrl).not.toContain("status=")
    expect(requestedUrl).toContain("sortBy=customer")
    expect(requestedUrl).toContain("sortOrder=desc")
  })

  test("create, update, archive, and restore encode IDs and surface API errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { customer: { custno: "C0010" } } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { message: "Active sales exist" } }), { status: 409 }))
      .mockRejectedValueOnce(new TypeError("network down"))
    vi.stubGlobal("fetch", fetchMock)

    const created = await customerApi.create({ custname: "Beta", address: "5 Oak", payterm: "45D" })
    expect(created.customer.custno).toBe("C0010")
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include" })

    await expect(customerApi.archive("C/0010")).rejects.toMatchObject({ message: "Active sales exist" })
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/customers/C%2F0010")

    await expect(customerApi.restore("C0010")).rejects.toThrow()
  })
})
