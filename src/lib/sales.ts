import type {
  PaymentStatus,
  SaleCatalogPriceEntry,
  SaleTransaction,
} from "../types/sale"

export const roundCurrency = (value: number): number => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export const getLineSubtotal = (quantity: number, unitPrice: number): number =>
  roundCurrency(Number(quantity) * Number(unitPrice))

export const getSaleSubtotal = (sale: SaleTransaction): number =>
  roundCurrency(
    sale.lines
      .filter((line) => line.status === "Active" || sale.status === "Inactive")
      .reduce((total, line) => total + getLineSubtotal(line.quantity, line.unitPrice), 0),
  )

export const getSaleTax = (sale: SaleTransaction, taxRate = 0): number =>
  roundCurrency(getSaleSubtotal(sale) * Math.max(0, Number(taxRate) || 0))

export const getSaleTotal = (sale: SaleTransaction): number =>
  roundCurrency(
    sale.lines
      .filter((line) => line.status === "Active")
      .reduce((total, line) => total + getLineSubtotal(line.quantity, line.unitPrice), 0),
  )

export const getPaymentsTotal = (sale: SaleTransaction): number =>
  roundCurrency(
    sale.payments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
  )

export const getSaleBalance = (sale: SaleTransaction): number =>
  Math.max(0, roundCurrency(getSaleTotal(sale) - getPaymentsTotal(sale)))

export const getPaymentStatus = (sale: SaleTransaction): PaymentStatus => {
  const total = getSaleTotal(sale)
  const paid = getPaymentsTotal(sale)
  const balance = Math.max(0, roundCurrency(total - paid))

  if (total > 0 && balance <= 0) return "Paid"
  if (paid > 0 && balance > 0) return "Partial"
  return "Unpaid"
}

export const lookupPriceAsOfDate = (
  priceHistory: SaleCatalogPriceEntry[],
  salesDate: string,
  fallbackPrice?: number | null,
): number | null => {
  const targetDate = salesDate?.trim() || new Intl.DateTimeFormat("en-CA").format(new Date())
  const eligible = [...(priceHistory || [])]
    .filter((entry) => entry.effectiveDate && entry.effectiveDate <= targetDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))

  if (eligible.length > 0) {
    return roundCurrency(eligible[0].price)
  }

  return typeof fallbackPrice === "number" && Number.isFinite(fallbackPrice)
    ? roundCurrency(fallbackPrice)
    : null
}
