export type PaymentTerm = "30D" | "45D" | "COD"

export type Customer = {
  id: string
  company: string
  name: string
  address: string
  paymentTerm: PaymentTerm
  status: "Active" | "Inactive"
  stamp: string
}
