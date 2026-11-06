import { afterEach, expect, test, vi } from "vitest"
import { salesApi } from "./sales-api"

afterEach(() => vi.unstubAllGlobals())

test("refreshes the inbox after successful writes but not reads or failures", async () => {
  const changed = vi.fn()
  window.addEventListener("hope:notifications-changed", changed)
  try {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { sale: { transno: "TR0001", lines: [], payments: [] } } }), { headers: { "Content-Type": "application/json" } })))
    await salesApi.get("TR0001")
    expect(changed).not.toHaveBeenCalled()
    await salesApi.archive("TR0001")
    expect(changed).toHaveBeenCalledTimes(1)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 500 })))
    await expect(salesApi.archive("TR0001")).rejects.toThrow()
    expect(changed).toHaveBeenCalledTimes(1)
  } finally { window.removeEventListener("hope:notifications-changed", changed) }
})

test("rejects malformed sales and catalog responses instead of inventing records or pagination", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), { headers: { "Content-Type": "application/json" } })))
  await expect(salesApi.list()).rejects.toThrow()
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { products: [] } }), { headers: { "Content-Type": "application/json" } })))
  await expect(salesApi.catalog()).rejects.toThrow()
})

test("does not treat a successful status without a saved sale as a successful write", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), { status: 201, headers: { "Content-Type": "application/json" } })))
  await expect(salesApi.create({ custno: "C001", empno: "00001", salesdate: "2026-11-02", lines: [{ prodcode: "PX0001", quantity: 1 }] })).rejects.toThrow()
})
