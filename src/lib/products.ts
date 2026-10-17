import type { Product } from "../types/product"

export const products: Product[] = [
  {
    code: "PRD-1001",
    description: "Standard fastener assembly",
    unitType: "pc",
    currentPrice: 12.5,
    priceHistory: [
      { effectiveDate: "2025-01-15", price: 12.5 },
      { effectiveDate: "2024-07-01", price: 11.85 },
      { effectiveDate: "2024-01-10", price: 11.25 },
    ],
  },
  {
    code: "PRD-1002",
    description: "Industrial cleaning solution",
    unitType: "ltr",
    currentPrice: 8.75,
    priceHistory: [
      { effectiveDate: "2025-02-01", price: 8.75 },
      { effectiveDate: "2024-08-12", price: 8.2 },
    ],
  },
  {
    code: "PRD-1003",
    description: "Reinforced electrical cable",
    unitType: "mtr",
    currentPrice: 4.35,
    priceHistory: [
      { effectiveDate: "2025-03-05", price: 4.35 },
      { effectiveDate: "2024-11-18", price: 4.1 },
      { effectiveDate: "2024-04-22", price: 3.9 },
    ],
  },
  {
    code: "PRD-1004",
    description: "Warehouse label set",
    unitType: "pkg",
    currentPrice: 21.9,
    priceHistory: [
      { effectiveDate: "2025-01-20", price: 21.9 },
      { effectiveDate: "2024-06-14", price: 20.5 },
    ],
  },
  {
    code: "PRD-1005",
    description: "Protective equipment unit",
    unitType: "ea",
    currentPrice: 34,
    priceHistory: [
      { effectiveDate: "2025-02-10", price: 34 },
      { effectiveDate: "2024-09-03", price: 32.75 },
    ],
  },
  {
    code: "PRD-1006",
    description: "Machine maintenance component",
    unitType: "pc",
    currentPrice: 48.6,
    priceHistory: [
      { effectiveDate: "2025-03-01", price: 48.6 },
      { effectiveDate: "2024-10-08", price: 46.25 },
      { effectiveDate: "2024-02-19", price: 44.8 },
    ],
  },
  {
    code: "PRD-1007",
    description: "Packaging liner material",
    unitType: "mtr",
    currentPrice: 6.15,
    priceHistory: [
      { effectiveDate: "2025-01-08", price: 6.15 },
      { effectiveDate: "2024-05-27", price: 5.8 },
    ],
  },
  {
    code: "PRD-1008",
    description: "Shipping carton bundle",
    unitType: "pkg",
    currentPrice: 27.4,
    priceHistory: [
      { effectiveDate: "2025-02-24", price: 27.4 },
      { effectiveDate: "2024-08-05", price: 25.95 },
    ],
  },
]
