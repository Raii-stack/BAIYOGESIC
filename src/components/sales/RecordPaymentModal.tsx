import { useEffect, useRef, useState, type FormEvent } from "react"

import useModalFocus from "../../hooks/useModalFocus"
import type { PaymentMethod, SalePayment } from "../../types/sale"
import { DashboardIcon } from "../dashboard/DashboardComponents"

type RecordPaymentModalProps = {
  open: boolean
  payment: SalePayment | null
  balance: number
  onClose: () => void
  onSave: (payment: SalePayment) => Promise<void>
}

const paymentMethods: PaymentMethod[] = ["Cash", "Bank Transfer", "Check", "Card", "E-wallet"]

export default function RecordPaymentModal({
  open,
  payment,
  balance,
  onClose,
  onSave,
}: RecordPaymentModalProps) {
  const [date, setDate] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("Cash")
  const [amountError, setAmountError] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const initialFocusRef = useRef<HTMLInputElement>(null)

  useModalFocus(open, dialogRef, initialFocusRef, onClose, saving)

  useEffect(() => {
    if (!open) return

    setDate(
      payment?.date ?? new Intl.DateTimeFormat("en-CA").format(new Date()),
    )
    setAmount(String(payment?.amount ?? balance.toFixed(2)))
    setMethod(payment?.paymentMethod ?? "Cash")
    setAmountError("")
    setFormError("")
  }, [balance, open, payment])

  if (!open) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    const availableBalance = balance + (payment?.amount ?? 0)

    if (!date) {
      setFormError("Payment date is required.")
      return
    }

    if (!numericAmount || numericAmount <= 0) {
      setAmountError("Payment amount must be greater than zero.")
      return
    }
    if (numericAmount > availableBalance) {
      setAmountError("Payment cannot exceed the remaining balance.")
      return
    }

    setSaving(true)
    setFormError("")
    try {
      await onSave({
        id: payment?.id ?? "",
        orNo: payment?.orNo ?? "",
        date,
        amount: numericAmount,
        paymentMethod: method,
        stamp: payment?.stamp ?? "",
      })
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to record payment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace-modal-overlay z-[70]">
      <button
        type="button"
        aria-label="Close payment form"
        onClick={() => { if (!saving) onClose() }}
        className="absolute inset-0 bg-black/45"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
        aria-describedby={formError ? "record-payment-form-error" : undefined}
        aria-busy={saving}
        className="workspace-modal workspace-panel relative w-full max-w-lg shadow-xl"
      >
        <header className="workspace-drawer-header">
          <div>
            <h2
              id="record-payment-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {payment ? "Edit Payment" : "Record Payment"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close payment form"
            className="workspace-icon-action"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="workspace-drawer-body space-y-4">
            <label className="block">
              <span className="workspace-label">
                Receipt number
              </span>
              <input
                type="text"
                readOnly
                value={payment?.orNo ?? "Auto-generated on save"}
                className="workspace-control"
              />
            </label>
            <label className="block">
              <span className="workspace-label">
                Payment date
              </span>
              <input
                ref={initialFocusRef}
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="workspace-control"
              />
            </label>
            <label className="block">
              <span className="workspace-label">Payment method</span>
              <select
                required
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                className="workspace-control"
              >
                {paymentMethods.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="workspace-label workspace-label--row">
                Amount
                <span className="font-medium text-slate-400">
                  Remaining balance: ${balance.toFixed(2)}
                </span>
              </span>
              <span className="relative block">
                <DashboardIcon
                  name="currency"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                    if (amountError) setAmountError("")
                  }}
                  aria-invalid={Boolean(amountError)}
                  aria-describedby="record-payment-error"
                  className={`workspace-control workspace-control--currency ${
                    amountError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
              </span>
              <p
                id="record-payment-error"
                aria-live="polite"
                className={amountError ? "mt-2 text-xs font-medium leading-4 text-red-600" : "sr-only"}
              >
                {amountError || "\u00a0"}
              </p>
            </label>
            {formError && <p id="record-payment-form-error" role="alert" className="text-sm font-semibold text-red-700">{formError}</p>}
          </div>

          <footer className="workspace-drawer-footer">
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
              {saving ? "Saving…" : "Save Payment"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
