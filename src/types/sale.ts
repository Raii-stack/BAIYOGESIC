export type RecordStatus = "Active" | "Inactive"

export type SaleLine = {
  id: string
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  status: RecordStatus
  stamp: string
}

export type SalePayment = {
  id: string
  orNo: string
  date: string
  amount: number
  stamp: string
}

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
}
