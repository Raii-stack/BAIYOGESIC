import { useEffect, useState } from "react"

import { getSaleTotal } from "../../lib/sales"
import type { SalePayment, SaleTransaction } from "../../types/sale"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import RecordPaymentModal from "./RecordPaymentModal"
import { StatusBadge } from "./SalesTable"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export default function SaleDetailsModal({
  sale,
  onClose,
  onPaymentsChange,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  showAdminAudit = false,
}: {
  sale: SaleTransaction | null
  onClose: () => void
  onPaymentsChange: (transactionNo: string, payments: SalePayment[]) => Promise<SaleTransaction>
  canAdd?: boolean
  canEdit?: boolean
  canDelete?: boolean
  showAdminAudit?: boolean
}) {
  const showDetailActions = canEdit || canDelete
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

  const updatePayments = async (
    updater: (current: SalePayment[]) => SalePayment[],
  ) => {
    const next = updater(payments)
    const updated = await onPaymentsChange(sale.transactionNo, next)
    setPayments(updated.payments)
  }

  const savePayment = async (payment: SalePayment) => {
    await updatePayments((current) =>
      current.some((entry) => entry.id === payment.id)
        ? current.map((entry) => (entry.id === payment.id ? payment : entry))
        : [...current, payment],
    )
  }

  return (
    <div className="workspace-modal-overlay z-[60]">
      <button
        type="button"
        aria-label="Close sale details"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-details-modal-title"
        className="workspace-modal workspace-panel relative w-full max-w-6xl shadow-xl"
      >
        <header className="workspace-drawer-header">
          <div>
            <h2
              id="sale-details-modal-title"
              className="text-xl font-semibold text-neutral-900"
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
            className="workspace-icon-action"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="workspace-drawer-body">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Line items
              </p>
            </div>
          </div>

          <div className="workspace-panel workspace-table-scroll">
            <table role="table" className="workspace-table min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  {[
                    "Product",
                    "Qty",
                    "Unit price",
                    "Line total",
                    ...(showAdminAudit ? ["Status", "Last change"] : []),
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`${
                        ["Unit price", "Line total"].includes(heading)
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
                {sale.lines.map((line) => (
                  <tr
                    key={line.id}
                    className={line.status === "Inactive" ? "is-muted" : ""}
                  >
                    <td data-label="Product">
                      <p className="font-mono text-xs font-medium text-neutral-600">
                        {line.productCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {line.productName}
                      </p>
                    </td>
                    <td data-label="Qty" className="text-sm font-semibold tabular-nums text-slate-800">
                      {line.quantity}
                    </td>
                    <td data-label="Unit price" className="text-right text-sm tabular-nums text-slate-700">
                      {currency.format(line.unitPrice)}
                    </td>
                    <td data-label="Line total" className="text-right text-sm font-bold tabular-nums text-slate-950">
                      {currency.format(line.quantity * line.unitPrice)}
                    </td>
                    {showAdminAudit && (
                      <td data-label="Status">
                        <StatusBadge status={line.status} />
                      </td>
                    )}
                    {showAdminAudit && (
                      <td data-label="Last change" className="max-w-52  font-mono text-[10px] leading-5 text-slate-500">
                        {line.stamp}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section
            aria-labelledby="payment-history-title"
            className="mt-6 border-t border-neutral-200 pt-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3
                  id="payment-history-title"
                  className="text-sm font-semibold text-neutral-900"
                >
                  Payment history
                </h3>
              </div>
              {canAdd && (
                <button
                  type="button"
                  disabled={balance <= 0}
                  onClick={() => {
                    setEditingPayment(null)
                    setPaymentModalOpen(true)
                  }}
                  className="workspace-primary-action"
                >
                  <DashboardIcon name="plus" className="h-4 w-4" />
                  Record Payment
                </button>
              )}
            </div>

            <div className="workspace-panel workspace-table-scroll">
              <table role="table" className="workspace-table min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100">
                    {[
                      "OR No.",
                      "Date",
                      "Method",
                      "Amount",
                      ...(showAdminAudit ? ["Last change"] : []),
                      ...(showDetailActions ? ["Actions"] : []),
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`${
                          heading === "Amount" ? "text-right" : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                    >
                      <td data-label="OR No." className="font-mono text-xs font-medium text-neutral-600">
                        {payment.orNo}
                      </td>
                      <td data-label="Date" className="font-mono text-xs text-slate-600">
                        {payment.date}
                      </td>
                      <td data-label="Method" className="text-xs font-medium text-slate-700">
                        {payment.paymentMethod ?? "Cash"}
                      </td>
                      <td data-label="Amount" className="text-right text-sm font-bold tabular-nums text-slate-950">
                        {currency.format(payment.amount)}
                      </td>
                      {showAdminAudit && (
                        <td data-label="Last change" className="max-w-52  font-mono text-[10px] leading-5 text-slate-500">
                          {payment.stamp}
                        </td>
                      )}
                      {showDetailActions && (
                        <td data-label="Actions">
                          <div className="flex gap-3">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPayment(payment)
                                  setPaymentModalOpen(true)
                                }}
                                className="workspace-text-action"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  void updatePayments((current) =>
                                    current.filter(
                                      (entry) => entry.id !== payment.id,
                                    ),
                                  ).catch(() => {})
                                }}
                                className="workspace-text-action text-red-700"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
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

        <footer className="workspace-summary workspace-summary--footer grid shrink-0 grid-cols-3 gap-3 border-t border-neutral-200 bg-white px-6 py-4 text-right">
          <div>
            <p className="text-xs font-medium text-neutral-500">
              Total
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {currency.format(getSaleTotal(sale))}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">
              Payments
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {currency.format(paymentTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">
              Balance
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">
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
