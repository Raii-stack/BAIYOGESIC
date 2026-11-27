import { expect, test } from "vitest"
import { classifyPriceHistory } from "./price-history"

test("sorts mixed entries newest-first and picks earliest upcoming plus latest current <= today", () => {
  const result = classifyPriceHistory(
    [
      { effectiveDate: "2026-01-01", price: 10 },
      { effectiveDate: "2026-12-01", price: 16 },
      { effectiveDate: "2026-10-01", price: 12.5 },
      { effectiveDate: "2026-11-25", price: 14 },
    ],
    "2026-11-23",
  )

  expect(result.items.map((item) => item.effectiveDate)).toEqual([
    "2026-12-01",
    "2026-11-25",
    "2026-10-01",
    "2026-01-01",
  ])
  expect(result.items.map((item) => item.tier)).toEqual([
    "upcoming",
    "upcoming",
    "current",
    "previous",
  ])
  expect(result.items.map((item) => item.isNew)).toEqual([true, true, false, false])
  expect(result.items[0].isNewest).toBe(true)
  expect(result.currentEntry?.effectiveDate).toBe("2026-10-01")
  expect(result.upcomingEntry?.effectiveDate).toBe("2026-11-25")
})

test("marks an entry effective today as current and new", () => {
  const result = classifyPriceHistory(
    [
      { effectiveDate: "2026-11-23", price: 15 },
      { effectiveDate: "2026-10-01", price: 12.5 },
    ],
    "2026-11-23",
  )

  expect(result.currentEntry).toMatchObject({
    effectiveDate: "2026-11-23",
    tier: "current",
    isCurrent: true,
    isNew: true,
    isNewest: true,
  })
  expect(result.items[1]).toMatchObject({
    effectiveDate: "2026-10-01",
    tier: "previous",
    isNew: false,
  })
})

test("marks a recentlyAddedDate entry as new", () => {
  const result = classifyPriceHistory(
    [
      { effectiveDate: "2026-11-10", price: 14 },
      { effectiveDate: "2026-10-01", price: 12.5 },
    ],
    "2026-11-23",
    "2026-11-10",
  )

  expect(result.currentEntry).toMatchObject({
    effectiveDate: "2026-11-10",
    isCurrent: true,
    isNew: true,
  })
})

test("handles all-future entries with no active current entry", () => {
  const result = classifyPriceHistory(
    [
      { effectiveDate: "2026-12-10", price: 20 },
      { effectiveDate: "2026-12-01", price: 18 },
    ],
    "2026-11-23",
  )

  expect(result.currentEntry).toBeNull()
  expect(result.upcomingEntry?.effectiveDate).toBe("2026-12-01")
  expect(result.items.every((item) => item.tier === "upcoming" && item.isUpcoming && item.isNew)).toBe(true)
})

test("handles empty price history cleanly", () => {
  const result = classifyPriceHistory([], "2026-11-23")

  expect(result.items).toEqual([])
  expect(result.currentEntry).toBeNull()
  expect(result.upcomingEntry).toBeNull()
})
