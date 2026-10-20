export type PaymentTerm = "Net 30" | "COD" | "Prepaid"

export type Customer = {
  id: string
  company: string
  name: string
  address: string
  paymentTerm: PaymentTerm
  status: "Active" | "Inactive"
  stamp: string
}
