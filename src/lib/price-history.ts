import type { PriceHistoryEntry } from "../types/product"

export type PriceTier = "current" | "upcoming" | "previous"

export type ClassifiedPriceEntry = PriceHistoryEntry & {
  tier: PriceTier
  isCurrent: boolean
  isUpcoming: boolean
  isNewest: boolean
  isNew: boolean
}

export function getTodayIsoDate(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now)
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(now)
  }
}

export function classifyPriceHistory(
  entries: PriceHistoryEntry[],
  today = getTodayIsoDate(),
  recentlyAddedDate?: string | null,
): {
  items: ClassifiedPriceEntry[]
  currentEntry: ClassifiedPriceEntry | null
  upcomingEntry: ClassifiedPriceEntry | null
  today: string
} {
  const sorted = [...entries].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
  const activeDate = sorted.find((entry) => entry.effectiveDate <= today)?.effectiveDate ?? null
  const newestDate = sorted[0]?.effectiveDate ?? null

  const items: ClassifiedPriceEntry[] = sorted.map((entry) => {
    const tier: PriceTier =
      entry.effectiveDate === activeDate
        ? "current"
        : entry.effectiveDate > today
          ? "upcoming"
          : "previous"
    const isCurrent = tier === "current"
    const isUpcoming = tier === "upcoming"
    const isNewest = newestDate !== null && entry.effectiveDate === newestDate
    const isNew = Boolean(
      (recentlyAddedDate && entry.effectiveDate === recentlyAddedDate) ||
        isUpcoming ||
        (isCurrent && entry.effectiveDate === today),
    )

    return {
      ...entry,
      tier,
      isCurrent,
      isUpcoming,
      isNewest,
      isNew,
    }
  })

  const currentEntry = items.find((item) => item.isCurrent) ?? null
  const upcomingEntry = items.filter((item) => item.isUpcoming).at(-1) ?? null

  return {
    items,
    currentEntry,
    upcomingEntry,
    today,
  }
}
