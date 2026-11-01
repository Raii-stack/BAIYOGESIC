import { useEffect, useState, type FormEvent } from "react"

import type { SalePayment } from "../../types/sale"
import { DashboardIcon } from "../dashboard/DashboardComponents"

type RecordPaymentModalProps = {
  open: boolean
  payment: SalePayment | null
  balance: number
  onClose: () => void
  onSave: (payment: SalePayment) => void
}

export default function RecordPaymentModal({
  open,
  payment,
  balance,
  onClose,
  onSave,
}: RecordPaymentModalProps) {
  const [date, setDate] = useState("")
  const [amount, setAmount] = useState("")
  const [amountError, setAmountError] = useState("")

  useEffect(() => {
    if (!open) return

    setDate(
      payment?.date ?? new Intl.DateTimeFormat("en-CA").format(new Date()),
    )
    setAmount(String(payment?.amount ?? balance.toFixed(2)))
    setAmountError("")

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [balance, onClose, open, payment])

  if (!open) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    const availableBalance = balance + (payment?.amount ?? 0)

    if (!numericAmount || numericAmount <= 0) {
      setAmountError("Payment amount must be greater than zero.")
      return
    }
    if (numericAmount > availableBalance) {
      setAmountError("Payment cannot exceed the remaining balance.")
      return
    }

    onSave({
      id: payment?.id ?? `PAY-${Date.now()}`,
      orNo: payment?.orNo ?? `OR-${String(Date.now()).slice(-5)}`,
      date,
      amount: numericAmount,
      stamp: payment
        ? "EDITED user1 2026-10-13 1:01 PM"
        : "CREATED system 2026-10-01 9:00 AM",
    })
    onClose()
  }

  return (
    <div className="workspace-modal-overlay z-[70]">
      <button
        type="button"
        aria-label="Close payment form"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
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
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="workspace-control"
              />
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
          </div>

          <footer className="workspace-drawer-footer">
            <button
              type="button"
              onClick={onClose}
              className="workspace-secondary-action"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-primary-action"
            >
              Save Payment
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
