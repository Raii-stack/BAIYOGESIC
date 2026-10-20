import { useEffect, useState, type FormEvent } from "react"

import type { SalePayment } from "../../types/sale"

type RecordPaymentModalProps = {
  open: boolean
  payment: SalePayment | null
  balance: number
  onClose: () => void
  onSave: (payment: SalePayment) => void
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
    <div className="fixed inset-0 z-[70] grid place-items-center px-4 py-8">
      <button
        type="button"
        aria-label="Close payment form"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-slate-300 border-t-[3px] border-t-blue-800 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-300 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              PAYMENT record
            </p>
            <h3
              id="record-payment-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {payment ? "Edit Payment" : "Record Payment"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment form"
            className="grid h-10 w-10 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={submit} noValidate>
          <div className="space-y-5 px-6 py-6">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">
                OR No.
              </span>
              <input
                type="text"
                readOnly
                value={payment?.orNo ?? "Auto-generated on save"}
                className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-500 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">
                Payment Date
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                Amount
                <span className="font-medium text-slate-400">
                  Remaining balance: ${balance.toFixed(2)}
                </span>
              </span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                  $
                </span>
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
                  className={`h-11 w-full rounded-md border bg-white pl-7 pr-3 text-sm font-semibold tabular-nums text-slate-900 outline-none transition ${
                    amountError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
              </span>
              <p
                id="record-payment-error"
                aria-live="polite"
                className={`min-h-6 pt-1.5 text-xs font-semibold ${
                  amountError ? "text-red-600" : "opacity-0"
                }`}
              >
                {amountError || "\u00a0"}
              </p>
            </label>
          </div>

          <footer className="flex justify-end gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              Save Payment
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
