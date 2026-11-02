import type { SaleTransaction } from "../../types/sale"
import { getPaymentStatus, getSaleBalance, getSaleTotal } from "../../lib/sales"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export default function SalesTable({
  sales,
  total,
  page,
  onPageChange,
  onDetails,
  onDelete,
  onRestore,
  canViewDetails = true,
  canDelete = true,
  canRestore = true,
  showAdminAudit = false,
}: {
  sales: SaleTransaction[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onDetails: (sale: SaleTransaction) => void
  onDelete: (transactionNo: string) => void
  onRestore: (transactionNo: string) => void
  canViewDetails?: boolean
  canDelete?: boolean
  canRestore?: boolean
  showAdminAudit?: boolean
}) {
  const showActions = canViewDetails || canDelete || canRestore
  return (
    <div className="workspace-panel">
      <div className="workspace-table-header">
        <h2>Sales transactions</h2>
        <span className="workspace-badge workspace-badge--neutral">
          {total} records
        </span>
      </div>
      <div className="overflow-x-auto">
        <table role="table" className="workspace-table min-w-[1040px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {[
                "Transaction",
                "Sales date",
                "Customer",
                "Employee",
                "Total",
                "Balance",
                ...(showAdminAudit ? ["Status", "Last change"] : []),
                ...(showActions ? ["Actions"] : []),
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={` ${
                    heading === "Actions" ? "workspace-table-actions" : ""
                  } ${
                    ["Total", "Balance"].includes(heading) ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const inactive = sale.status === "Inactive"
              const paymentStatus = getPaymentStatus(sale)

              return (
                <tr
                  key={sale.transactionNo}
                  className={inactive ? "is-muted" : ""}
                >
                  <td data-label="Transaction" className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600">
                    {sale.transactionNo}
                  </td>
                  <td data-label="Sales date" className="whitespace-nowrap font-mono text-xs text-slate-600">
                    {sale.salesDate}
                  </td>
                  <td data-label="Customer">
                    <p className="text-[13px] font-semibold text-slate-900">
                      {sale.customerName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sale.customerCode}
                    </p>
                  </td>
                  <td data-label="Employee">
                    <p className="text-[13px] font-medium text-slate-800">
                      {sale.employeeName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sale.employeeCode}
                    </p>
                  </td>
                  <td data-label="Total" className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-neutral-900">
                    {currency.format(getSaleTotal(sale))}
                  </td>
                  <td data-label="Balance" className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-neutral-900">
                    <span>{currency.format(getSaleBalance(sale))}</span>
                    <span className="ml-2 inline-block align-middle">
                      <PaymentStatusBadge status={paymentStatus} />
                    </span>
                  </td>
                  {showAdminAudit && (
                    <td data-label="Status">
                      <StatusBadge status={sale.status} />
                    </td>
                  )}
                  {showAdminAudit && (
                    <td data-label="Last change" className="max-w-56 font-mono text-[10px] leading-5 text-slate-500">
                      {sale.stamp}
                    </td>
                  )}
                  {showActions && (
                    <td data-label="Actions" className="workspace-table-actions">
                      {inactive ? (
                        canRestore ? (
                          <button
                            type="button"
                            onClick={() => onRestore(sale.transactionNo)}
                            aria-label={`Restore ${sale.transactionNo}`}
                            className="workspace-text-action text-emerald-700"
                          >
                            Restore
                          </button>
                        ) : null
                      ) : (
                        <div className="flex items-center gap-3">
                          {canViewDetails && (
                            <button
                              type="button"
                              onClick={() => onDetails(sale)}
                              className="workspace-text-action"
                            >
                              Details
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(sale.transactionNo)}
                              aria-label={`Archive ${sale.transactionNo}`}
                              className="workspace-text-action text-red-700"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sales.length === 0 && (
        <div className="workspace-empty-state">
          <p className="text-[13px] font-medium text-slate-700">
            No sales match this view.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the search or status filter.
          </p>
        </div>
      )}

      <div className="workspace-table-footer">
        <p>
          Showing {total ? (page - 1) * 10 + 1 : 0}–
          {Math.min(page * 10, total)} of {total}
        </p>
        <nav aria-label="Sales table pagination" className="workspace-pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="workspace-secondary-action"
          >
            Previous
          </button>
          <span className="text-xs text-slate-600">
            Page {page} of {Math.max(1, Math.ceil(total / 10))}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= Math.ceil(total / 10)}
            className="workspace-secondary-action"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  )
}

export function PaymentStatusBadge({ status }: { status: "Paid" | "Partial" | "Unpaid" }) {
  const styles = {
    Paid: "bg-emerald-100 text-emerald-800",
    Partial: "bg-amber-100 text-amber-800",
    Unpaid: "bg-rose-100 text-rose-800",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}

export function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
  const styles = {
    Active: "bg-emerald-100 text-emerald-800",
    Inactive: "bg-slate-100 text-slate-800",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      {status === "Inactive" ? "Archived" : status}
    </span>
  )
}
