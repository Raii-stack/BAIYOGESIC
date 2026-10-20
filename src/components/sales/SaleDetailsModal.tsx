import { useEffect, useState } from "react"

import { getSaleTotal } from "../../lib/sales"
import type { SalePayment, SaleTransaction } from "../../types/sale"
import RecordPaymentModal from "./RecordPaymentModal"
import { StatusBadge } from "./SalesTable"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

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

function AddIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export default function SaleDetailsModal({
  sale,
  onClose,
  onPaymentsChange,
  showAdminAudit = false,
}: {
  sale: SaleTransaction | null
  onClose: () => void
  onPaymentsChange: (transactionNo: string, payments: SalePayment[]) => void
  showAdminAudit?: boolean
}) {
  const [payments, setPayments] = useState<SalePayment[]>([])
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<SalePayment | null>(null)

  useEffect(() => {
    setPayments(sale?.payments ?? [])
    setPaymentModalOpen(false)
    setEditingPayment(null)
  }, [sale])

  useEffect(() => {
    if (!sale) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !paymentModalOpen) onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, paymentModalOpen, sale])

  if (!sale) return null
  const paymentTotal = payments.reduce(
    (total, payment) => total + payment.amount,
    0,
  )
  const balance = Math.max(0, getSaleTotal(sale) - paymentTotal)

  const updatePayments = (
    updater: (current: SalePayment[]) => SalePayment[],
  ) => {
    setPayments((current) => {
      const next = updater(current)
      onPaymentsChange(sale.transactionNo, next)
      return next
    })
  }

  const savePayment = (payment: SalePayment) => {
    updatePayments((current) =>
      current.some((entry) => entry.id === payment.id)
        ? current.map((entry) => (entry.id === payment.id ? payment : entry))
        : [...current, payment],
    )
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4 py-6">
      <button
        type="button"
        aria-label="Close sale details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-details-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-300 border-t-[3px] border-t-blue-800 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-slate-300 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Sales / Master-detail
            </p>
            <h2
              id="sale-details-modal-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              Sale Details — {sale.transactionNo}
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
              <span>
                <strong className="text-slate-900">Date:</strong>{" "}
                {sale.salesDate}
              </span>
              <span>
                <strong className="text-slate-900">Customer:</strong>{" "}
                {sale.customerName}
              </span>
              <StatusBadge status={sale.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sale details"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                SALESDETAIL junction
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                Line Items
              </p>
            </div>
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-md bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              <AddIcon />
              Add Line
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-300">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  {[
                    "Product",
                    "Qty",
                    "Unit Price",
                    "Line Total",
                    "Status",
                    ...(showAdminAudit ? ["Stamp"] : []),
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 ${
                        ["Unit Price", "Line Total"].includes(heading)
                          ? "text-right"
                          : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((line, index) => (
                  <tr
                    key={line.id}
                    className={`border-b border-slate-200 last:border-b-0 ${
                      line.status === "Inactive"
                        ? "bg-red-50/70 text-slate-500"
                        : index % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs font-bold text-blue-800">
                        {line.productCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {line.productName}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold tabular-nums text-slate-800">
                      {line.quantity}
                    </td>
                    <td className="px-4 py-4 text-right text-sm tabular-nums text-slate-700">
                      {currency.format(line.unitPrice)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-bold tabular-nums text-slate-950">
                      {currency.format(line.quantity * line.unitPrice)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={line.status} />
                    </td>
                    {showAdminAudit && (
                      <td className="max-w-52 px-4 py-4 font-mono text-[10px] leading-5 text-slate-500">
                        {line.stamp}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-xs font-bold text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section
            aria-labelledby="payment-history-title"
            className="mt-8 border-t border-slate-300 pt-6"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  PAYMENT ledger
                </p>
                <h3
                  id="payment-history-title"
                  className="mt-1 text-sm font-bold text-slate-900"
                >
                  Payment History
                </h3>
              </div>
              <button
                type="button"
                disabled={balance <= 0}
                onClick={() => {
                  setEditingPayment(null)
                  setPaymentModalOpen(true)
                }}
                className="flex h-10 items-center gap-2 rounded-md bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <AddIcon />
                Record Payment
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100">
                    {[
                      "OR No.",
                      "Date",
                      "Amount",
                      ...(showAdminAudit ? ["Stamp"] : []),
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 ${
                          heading === "Amount" ? "text-right" : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr
                      key={payment.id}
                      className={`border-b border-slate-200 last:border-b-0 ${
                        index % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-800">
                        {payment.orNo}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {payment.date}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-950">
                        {currency.format(payment.amount)}
                      </td>
                      {showAdminAudit && (
                        <td className="max-w-52 px-4 py-3 font-mono text-[10px] leading-5 text-slate-500">
                          {payment.stamp}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(payment)
                              setPaymentModalOpen(true)
                            }}
                            className="text-xs font-bold text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updatePayments((current) =>
                                current.filter(
                                  (entry) => entry.id !== payment.id,
                                ),
                              )
                            }
                            className="text-xs font-bold text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  No payments have been recorded for this transaction.
                </p>
              )}
            </div>
          </section>
        </div>

        <footer className="grid shrink-0 grid-cols-3 gap-6 border-t border-slate-300 bg-slate-50 px-6 py-4 text-right sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Total
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {currency.format(getSaleTotal(sale))}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Payments
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {currency.format(paymentTotal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800">
              Balance
            </p>
            <p className="mt-1 text-xl font-bold tracking-[-0.02em] tabular-nums text-blue-950">
              {currency.format(balance)}
            </p>
          </div>
        </footer>
      </section>

      <RecordPaymentModal
        open={paymentModalOpen}
        payment={editingPayment}
        balance={balance}
        onClose={() => {
          setPaymentModalOpen(false)
          setEditingPayment(null)
        }}
        onSave={savePayment}
      />
    </div>
  )
}
