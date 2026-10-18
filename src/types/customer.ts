export type PaymentTerm = "COD" | "30D" | "45D"

export type Customer = {
  id: string
  company: string
  name: string
  address: string
  paymentTerm: PaymentTerm
}
