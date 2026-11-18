import { describe, expect, test } from "vitest"
import type { SaleCatalogPriceEntry, SaleTransaction } from "../types/sale"
import {
  getLineSubtotal,
  getPaymentsTotal,
  getPaymentStatus,
  getSaleBalance,
  getSaleSubtotal,
  getSaleTax,
  getSaleTotal,
  lookupPriceAsOfDate,
  roundCurrency,
} from "./sales"

function makeSale(overrides: Partial<SaleTransaction> = {}): SaleTransaction {
  return {
    transactionNo: "TR000010",
    salesDate: "2026-11-01",
    customerCode: "C0001",
    customerName: "Acme Corp",
    employeeCode: "00001",
    employeeName: "Jane Reyes",
    status: "Active",
    stamp: "ADD admin",
    lines: [
      { id: "1", productCode: "PX0001", productName: "Balm", quantity: 3, unitPrice: 19.99, status: "Active", stamp: "" },
      { id: "2", productCode: "PX0002", productName: "Oil", quantity: 2, unitPrice: 10.5, status: "Inactive", stamp: "" },
    ],
    payments: [],
    ...overrides,
  }
}

describe("lib/sales ([S4-DEV-01 & S4-DEV-02])", () => {
  test("roundCurrency and getLineSubtotal eliminate binary floating-point drift", () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3)
    expect(roundCurrency(Number.NaN)).toBe(0)
    expect(roundCurrency(Number.POSITIVE_INFINITY)).toBe(0)
    expect(getLineSubtotal(3, 19.99)).toBe(59.97)
  })

  test("calculates totals for active vs archived orders and positive tax rates", () => {
    const activeSale = makeSale()
    expect(getSaleSubtotal(activeSale)).toBe(59.97)
    expect(getSaleTotal(activeSale)).toBe(59.97)
    expect(getSaleTax(activeSale, 0.12)).toBe(7.2)
    expect(getSaleTax(activeSale, -0.05)).toBe(0)

    const archivedSale = makeSale({ status: "Inactive" })
    expect(getSaleSubtotal(archivedSale)).toBe(80.97)
    expect(getSaleTotal(archivedSale)).toBe(59.97)
  })

  test("derives payments total, clamped balance, and Unpaid/Partial/Paid status", () => {
    const unpaid = makeSale()
    expect(getPaymentsTotal(unpaid)).toBe(0)
    expect(getSaleBalance(unpaid)).toBe(59.97)
    expect(getPaymentStatus(unpaid)).toBe("Unpaid")

    const partial = makeSale({
      payments: [{ id: "OR1", orNo: "OR000001", date: "2026-11-02", amount: 25.0, paymentMethod: "Cash", stamp: "" }],
    })
    expect(getPaymentsTotal(partial)).toBe(25)
    expect(getSaleBalance(partial)).toBe(34.97)
    expect(getPaymentStatus(partial)).toBe("Partial")

    const overpaid = makeSale({
      payments: [
        { id: "OR1", orNo: "OR000001", date: "2026-11-02", amount: 25.0, paymentMethod: "Cash", stamp: "" },
        { id: "OR2", orNo: "OR000002", date: "2026-11-03", amount: 40.0, paymentMethod: "Card", stamp: "" },
      ],
    })
    expect(getSaleBalance(overpaid)).toBe(0)
    expect(getPaymentStatus(overpaid)).toBe("Paid")
  })

  test("lookupPriceAsOfDate picks latest effective price on or before salesDate and handles fallbacks", () => {
    const history: SaleCatalogPriceEntry[] = [
      { effectiveDate: "2026-01-01", price: 12.5 },
      { effectiveDate: "2026-06-01", price: 15.255 },
      { effectiveDate: "2026-12-01", price: 20 },
    ]

    expect(lookupPriceAsOfDate(history, "2026-05-15", 99)).toBe(12.5)
    expect(lookupPriceAsOfDate(history, "2026-06-01", 99)).toBe(15.26)
    expect(lookupPriceAsOfDate(history, "2025-12-31", 9.99)).toBe(9.99)
    expect(lookupPriceAsOfDate(history, "2025-12-31", null)).toBeNull()
  })
})
