import { useRef } from "react"

import useModalFocus from "../../hooks/useModalFocus"
import { DashboardIcon } from "../dashboard/DashboardComponents"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export type ConfirmSaleLine = {
  id: string
  productCode: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
  subtotal: number
}

type ConfirmSaleModalProps = {
  open: boolean
  transactionNo: string
  salesDate: string
  customerName: string
  customerCode: string
  paymentTerm?: string
  employeeName: string
  employeeCode: string
  lines: ConfirmSaleLine[]
  subtotal: number
  tax: number
  totalAmount: number
  submitting: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmSaleModal({
  open,
  transactionNo,
  salesDate,
  customerName,
  customerCode,
  paymentTerm,
  employeeName,
  employeeCode,
  lines,
  subtotal,
  tax,
  totalAmount,
  submitting,
  error,
  onClose,
  onConfirm,
}: ConfirmSaleModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useModalFocus(open, dialogRef, cancelRef, onClose, submitting)

  if (!open) return null

  return (
    <div className="workspace-modal-overlay z-[60]">
      <button
        type="button"
        aria-label="Close order confirmation"
        onClick={() => {
          if (!submitting) onClose()
        }}
        className="absolute inset-0 bg-black/45"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-sale-modal-title"
        aria-busy={submitting}
        className="workspace-modal workspace-panel relative w-full max-w-3xl shadow-xl"
      >
        <header className="workspace-drawer-header">
          <div>
            <h2
              id="confirm-sale-modal-title"
              className="text-xl font-semibold text-neutral-900"
            >
              Confirm sales order
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Review the complete order before saving.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close order confirmation"
            className="workspace-icon-action"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="workspace-drawer-body space-y-5">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-500">Transaction</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900">
                {transactionNo}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Sales date</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900">
                {salesDate}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Customer</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {customerName}
              </p>
              <p className="mt-0.5 font-mono text-slate-500">
                {customerCode}
                {paymentTerm ? ` · ${paymentTerm}` : ""}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Salesperson</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {employeeName}
              </p>
              <p className="mt-0.5 font-mono text-slate-500">{employeeCode}</p>
            </div>
          </div>

          <div className="workspace-panel workspace-table-scroll">
            <table role="table" className="workspace-table">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th scope="col">Product</th>
                  <th scope="col" className="text-right">
                    Qty
                  </th>
                  <th scope="col" className="text-right">
                    Unit price
                  </th>
                  <th scope="col" className="text-right">
                    Line subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td data-label="Product">
                      <p className="font-mono text-xs font-semibold text-slate-800">
                        {line.productCode}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {line.description}
                      </p>
                    </td>
                    <td
                      data-label="Qty"
                      className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-800"
                    >
                      {line.quantity} {line.unit}
                    </td>
                    <td
                      data-label="Unit price"
                      className="whitespace-nowrap text-right text-sm tabular-nums text-slate-700"
                    >
                      {currency.format(line.unitPrice)}
                    </td>
                    <td
                      data-label="Line subtotal"
                      className="whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-950"
                    >
                      {currency.format(line.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="workspace-summary grid grid-cols-3 gap-4 border-t border-neutral-200 pt-4 text-right">
            <div>
              <p className="text-xs font-medium text-neutral-500">Subtotal</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                {currency.format(subtotal)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Tax</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                {currency.format(tax)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Total</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">
                {currency.format(totalAmount)}
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <footer className="workspace-drawer-footer">
          <button
            ref={cancelRef}
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="workspace-secondary-action"
          >
            Back to edit
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="workspace-primary-action"
          >
            {submitting ? "Saving..." : "Confirm & save sale"}
          </button>
        </footer>
      </section>
    </div>
  )
}
