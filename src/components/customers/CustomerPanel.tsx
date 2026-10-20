import { useEffect, useState, type FormEvent } from "react"

import type { Customer, PaymentTerm } from "../../types/customer"

type CustomerPanelProps = {
  customer: Customer | null
  open: boolean
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export default function CustomerPanel({
  customer,
  open,
  onClose,
}: CustomerPanelProps) {
  const [customerName, setCustomerName] = useState("")
  const [address, setAddress] = useState("")
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("")
  const [nameError, setNameError] = useState("")
  const [addressError, setAddressError] = useState("")
  const [paymentTermError, setPaymentTermError] = useState("")

  useEffect(() => {
    if (!open) return

    setCustomerName(customer?.company ?? "")
    setAddress(customer?.address ?? "")
    setPaymentTerm(customer?.paymentTerm ?? "")
    setNameError("")
    setAddressError("")
    setPaymentTermError("")
  }, [customer, open])

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open])

  const submit = (event: FormEvent) => {
    event.preventDefault()

    const nextNameError = customerName.trim()
      ? ""
      : "Customer Name is required."
    const nextAddressError = address.trim() ? "" : "Address is required."
    const nextPaymentTermError = paymentTerm ? "" : "Payment Term is required."

    setNameError(nextNameError)
    setAddressError(nextAddressError)
    setPaymentTermError(nextPaymentTermError)
    if (nextNameError || nextAddressError || nextPaymentTermError) return

    onClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close customer details"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-panel-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.14)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-300 px-6 py-6 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              CRM / Customer record
            </p>
            <h2
              id="customer-panel-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              Customer Details
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {customer
                ? "Review and update this customer record."
                : "Enter the information required to create a customer record."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer details"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <form
          id="customer-details-form"
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
            <div className="border-l-2 border-blue-800 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-900">
                Record information
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Customer IDs are assigned automatically and cannot be edited.
              </p>
            </div>

            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Customer ID
                </span>
                <input
                  type="text"
                  readOnly
                  value={customer?.id ?? "Auto-generated on save"}
                  className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-500 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                  Customer Name
                  <span className="font-medium text-slate-400">Required</span>
                </span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value)
                    if (nameError) setNameError("")
                  }}
                  placeholder="Enter customer or company name"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby="customer-name-error"
                  className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
                    nameError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
                <p
                  id="customer-name-error"
                  aria-live="polite"
                  className={`min-h-6 pt-1.5 text-xs font-semibold ${
                    nameError ? "text-red-600" : "opacity-0"
                  }`}
                >
                  {nameError || "\u00a0"}
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Address
                </span>
                <textarea
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value)
                    if (addressError) setAddressError("")
                  }}
                  placeholder="Enter the complete business address"
                  rows={5}
                  aria-invalid={Boolean(addressError)}
                  aria-describedby="customer-address-error"
                  className={`w-full resize-none rounded-md border bg-white px-3 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 ${
                    addressError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
                <p
                  id="customer-address-error"
                  aria-live="polite"
                  className={`min-h-6 pt-1.5 text-xs font-semibold ${
                    addressError ? "text-red-600" : "opacity-0"
                  }`}
                >
                  {addressError || "\u00a0"}
                </p>
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                  Payment Terms
                  <span className="font-medium text-slate-400">
                    Select only
                  </span>
                </span>
                <span className="relative block">
                  <select
                    value={paymentTerm}
                    onChange={(event) => {
                      setPaymentTerm(event.target.value as PaymentTerm | "")
                      if (paymentTermError) setPaymentTermError("")
                    }}
                    aria-invalid={Boolean(paymentTermError)}
                    aria-describedby="customer-payment-term-error"
                    className={`h-11 w-full appearance-none rounded-md border bg-slate-50 px-3 pr-9 text-sm outline-none transition ${
                      paymentTerm ? "text-slate-800" : "text-slate-400"
                    } ${
                      paymentTermError
                        ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                        : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                    }`}
                  >
                    <option value="">Select payment terms</option>
                    <option value="Net 30">Net 30</option>
                    <option value="COD">COD</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="m6 8 4 4 4-4" />
                  </svg>
                </span>
                <p
                  id="customer-payment-term-error"
                  aria-live="polite"
                  className={`min-h-6 pt-1.5 text-xs font-semibold ${
                    paymentTermError ? "text-red-600" : "opacity-0"
                  }`}
                >
                  {paymentTermError || "\u00a0"}
                </p>
              </label>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-300 bg-white px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              Save Customer
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
