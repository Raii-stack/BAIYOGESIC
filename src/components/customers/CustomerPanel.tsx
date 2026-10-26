import { useEffect, useState, type FormEvent } from "react"

import type { Customer, PaymentTerm } from "../../types/customer"
import type { CustomerInput } from "../../lib/customer-api"

type CustomerPanelProps = {
  customer: Customer | null
  open: boolean
  onClose: () => void
  onSave: (input: CustomerInput) => Promise<void>
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
  onSave,
}: CustomerPanelProps) {
  const [customerName, setCustomerName] = useState("")
  const [address, setAddress] = useState("")
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("")
  const [nameError, setNameError] = useState("")
  const [addressError, setAddressError] = useState("")
  const [paymentTermError, setPaymentTermError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    setCustomerName(customer?.company ?? "")
    setAddress(customer?.address ?? "")
    setPaymentTerm(customer?.paymentTerm ?? "")
    setNameError("")
    setAddressError("")
    setPaymentTermError("")
    setSaveError("")
  }, [customer, open])

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open, saving])

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    const nextNameError = !customerName.trim()
      ? "Customer Name is required."
      : customerName.trim().length > 20
        ? "Customer Name must be 20 characters or fewer."
        : ""
    const nextAddressError = !address.trim()
      ? "Address is required."
      : address.trim().length > 50
        ? "Address must be 50 characters or fewer."
        : ""
    const nextPaymentTermError = paymentTerm ? "" : "Payment Term is required."

    setNameError(nextNameError)
    setAddressError(nextAddressError)
    setPaymentTermError(nextPaymentTermError)
    if (nextNameError || nextAddressError || nextPaymentTermError) return

    setSaving(true)
    setSaveError("")
    try {
      await onSave({ custname: customerName.trim(), address: address.trim(), payterm: paymentTerm as PaymentTerm })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save customer.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        aria-label="Close customer details"
        onClick={() => { if (!saving) onClose() }}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-panel-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-neutral-200 bg-white shadow-xl workspace-drawer transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="workspace-drawer-header">
          <div>

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
            onClick={() => { if (!saving) onClose() }}
            aria-label="Close customer details"
            className="workspace-icon-action"
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
          <div className="workspace-drawer-body">
            <div className="workspace-notice">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-900">
                Record information
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Customer IDs are assigned automatically and cannot be edited.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="workspace-label">
                  Customer ID
                </span>
                <input
                  type="text"
                  readOnly
                  value={customer?.id ?? "Auto-generated on save"}
                  className="workspace-control"
                />
              </label>

              <label className="block">
                <span className="workspace-label workspace-label--row">
                  Customer Name
                  <span className="font-medium text-slate-400">Required</span>
                </span>
                <input
                  type="text"
                  value={customerName}
                  maxLength={20}
                  onChange={(event) => {
                    setCustomerName(event.target.value)
                    if (nameError) setNameError("")
                  }}
                  placeholder="Enter customer or company name"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby="customer-name-error"
                  className={`workspace-control ${
                    nameError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
                <p
                  id="customer-name-error"
                  aria-live="polite"
                  className={nameError ? "mt-2 text-xs font-medium leading-4 text-red-600" : "sr-only"}
                >
                  {nameError || "\u00a0"}
                </p>
              </label>

              <label className="block">
                <span className="workspace-label">
                  Address
                </span>
                <textarea
                  value={address}
                  maxLength={50}
                  onChange={(event) => {
                    setAddress(event.target.value)
                    if (addressError) setAddressError("")
                  }}
                  placeholder="Enter the complete business address"
                  rows={5}
                  aria-invalid={Boolean(addressError)}
                  aria-describedby="customer-address-error"
                  className={`workspace-control ${
                    addressError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
                <p
                  id="customer-address-error"
                  aria-live="polite"
                  className={addressError ? "mt-2 text-xs font-medium leading-4 text-red-600" : "sr-only"}
                >
                  {addressError || "\u00a0"}
                </p>
              </label>

              <label className="block">
                <span className="workspace-label workspace-label--row">
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
                    className={`workspace-control ${
                      paymentTerm ? "text-slate-800" : "text-slate-400"
                    } ${
                      paymentTermError
                        ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                        : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                    }`}
                  >
                    <option value="">Select payment terms</option>
                    <option value="30D">Net 30</option>
                    <option value="COD">COD</option>
                    <option value="45D">Net 45</option>
                    <option value="60D">Net 60</option>
                  </select>
                </span>
                <p
                  id="customer-payment-term-error"
                  aria-live="polite"
                  className={paymentTermError ? "mt-2 text-xs font-medium leading-4 text-red-600" : "sr-only"}
                >
                  {paymentTermError || "\u00a0"}
                </p>
              </label>
            </div>
          </div>

          <footer className="workspace-drawer-footer">
            {saveError && <p role="alert" className="mr-auto text-xs font-semibold text-red-700">{saveError}</p>}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="workspace-secondary-action"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="workspace-primary-action"
            >
              {saving ? "Saving…" : customer ? "Save changes" : "Create customer"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
