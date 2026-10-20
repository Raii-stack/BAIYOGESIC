import type { SaleTransaction } from "../../types/sale"
import { getSaleBalance, getSaleTotal } from "../../lib/sales"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export default function SalesTable({
  sales,
  onDetails,
  onDelete,
  onRestore,
  showAdminAudit = false,
}: {
  sales: SaleTransaction[]
  onDetails: (sale: SaleTransaction) => void
  onDelete: (transactionNo: string) => void
  onRestore: (transactionNo: string) => void
  showAdminAudit?: boolean
}) {
  return (
    <div className="overflow-hidden border border-slate-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1480px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {[
                "Trans No",
                "Sales Date",
                "Customer",
                "Employee",
                "Total",
                "Balance",
                "Status",
                ...(showAdminAudit ? ["Stamp"] : []),
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-4 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 first:pl-6 last:pr-6 ${
                    ["Total", "Balance"].includes(heading) ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, index) => {
              const inactive = sale.status === "Inactive"

              return (
                <tr
                  key={sale.transactionNo}
                  className={`border-b border-slate-200 last:border-b-0 ${
                    inactive
                      ? "bg-red-50/70 text-slate-500"
                      : index % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50"
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-4 pl-6 font-mono text-xs font-bold text-blue-800">
                    {sale.transactionNo}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">
                    {sale.salesDate}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-slate-900">
                      {sale.customerCode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sale.customerName}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-slate-800">
                      {sale.employeeCode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sale.employeeName}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-bold tabular-nums text-slate-950">
                    {currency.format(getSaleTotal(sale))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-bold tabular-nums text-blue-900">
                    {currency.format(getSaleBalance(sale))}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={sale.status} />
                  </td>
                  {showAdminAudit && (
                    <td className="max-w-56 px-4 py-4 font-mono text-[10px] leading-5 text-slate-500">
                      {sale.stamp}
                    </td>
                  )}
                  <td className="px-4 py-4 pr-6">
                    {inactive ? (
                      <button
                        type="button"
                        onClick={() => onRestore(sale.transactionNo)}
                        className="text-xs font-bold text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        Restore
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onDetails(sale)}
                          className="text-xs font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(sale.transactionNo)}
                          className="text-xs font-bold text-red-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sales.length === 0 && (
        <div className="px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No sales match this view.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the search or select another status tab.
          </p>
        </div>
      )}

      <div className="border-t border-slate-300 px-6 py-4 text-xs font-medium text-slate-600">
        Showing {sales.length} transaction records
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: SaleTransaction["status"] }) {
  return (
    <span
      className={`inline-flex border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
        status === "Active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-300 bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  )
}
