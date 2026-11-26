import { describe, expect, test } from "vitest"
import { isPageSize, PAGE_SIZE_OPTIONS } from "./table-sorting"

describe("lib/table-sorting ([S2-UIX-01])", () => {
  test("exposes supported directory page sizes of 10, 25, and 50", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50])
  })

  test.each([10, 25, 50])("accepts valid page size %s", (size) => {
    expect(isPageSize(size)).toBe(true)
  })

  test.each([0, -10, 5, 15, 100, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects unsupported page size %s",
    (size) => {
      expect(isPageSize(size)).toBe(false)
    },
  )
})
