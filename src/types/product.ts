export type UnitType = "pc" | "ea" | "mtr" | "pkg" | "ltr"

export type PriceHistoryEntry = {
  effectiveDate: string
  price: number
  status?: "Active" | "Inactive"
  stamp?: string
}

export type Product = {
  code: string
  description: string
  unitType: UnitType
  currentPrice: number | null
  priceEffectiveDate: string | null
  status: "Active" | "Inactive"
  stamp: string
}
