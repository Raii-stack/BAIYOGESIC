export type RecordStatus = "Active" | "Inactive"

export type PaymentStatus = "Paid" | "Partial" | "Unpaid"

export type SaleLine = {
  id: string
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  status: RecordStatus
  stamp: string
}

export type SalesLineItem = SaleLine & {
  unit?: string
  lineTotal?: number
  effectiveDate?: string | null
}

export type SalePayment = {
  id: string
  orNo: string
  date: string
  amount: number
  stamp: string
}

export type Payment = SalePayment

export type SaleTransaction = {
  transactionNo: string
  salesDate: string
  customerCode: string
  customerName: string
  employeeCode: string
  employeeName: string
  status: RecordStatus
  stamp: string
  lines: SaleLine[]
  payments: SalePayment[]
  subtotal?: number
  tax?: number
  totalAmount?: number
  amountPaid?: number
  balance?: number
  paymentStatus?: PaymentStatus
}

export type SalesOrder = SaleTransaction

export type SaleCatalogPriceEntry = {
  effectiveDate: string
  price: number
}

export type SaleCatalogProduct = {
  code: string
  description: string
  unit: string
  currentPrice: number
  priceHistory: SaleCatalogPriceEntry[]
}
