export type UnitType = "pc" | "ea" | "mtr" | "pkg" | "ltr"

export type PriceHistoryEntry = {
  effectiveDate: string
  price: number
}

export type Product = {
  code: string
  description: string
  unitType: UnitType
  currentPrice: number
  priceHistory: PriceHistoryEntry[]
}
