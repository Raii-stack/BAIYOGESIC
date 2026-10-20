import type { Customer } from "../../types/customer"
import type { CustomerPagination } from "../../lib/customer-api"

const termLabels: Record<Customer["paymentTerm"], string> = {
  "30D": "Net 30",
  "45D": "Net 45",
  COD: "Cash on delivery",
}

const termStyles: Record<Customer["paymentTerm"], string> = {
  "30D": "border-blue-200 bg-blue-50 text-blue-800",
  "45D": "border-violet-200 bg-violet-50 text-violet-800",
  COD: "border-amber-200 bg-amber-50 text-amber-900",
}

function SkeletonRows({ showActions, canViewAudit }: { showActions: boolean; canViewAudit: boolean }) {
  const widths = [
    "w-20",
    "w-40",
    "w-52",
    "w-24",
    ...(canViewAudit ? ["w-16", "w-36"] : []),
    ...(showActions ? ["w-16"] : []),
  ]
  return Array.from({ length: 8 }, (_, index) => (
    <tr key={index} className="border-b border-slate-100 last:border-0" aria-hidden="true">
      {widths.map((width, column) => (
        <td key={column} className="px-5 py-5 first:pl-6 last:pr-6">
          <div className={`h-3.5 ${width} max-w-full animate-pulse rounded bg-slate-200`} />
        </td>
      ))}
    </tr>
  ))
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" /></svg>
}

function ArchiveIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>
}

function RestoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
}

function visiblePages(page: number, totalPages: number) {
  const count = Math.min(totalPages, 5)
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1))
  return Array.from({ length: count }, (_, index) => start + index)
}

export default function CustomerTable({
  customers,
  pagination,
  loading,
  error,
  onPageChange,
  onEdit,
  onArchive,
  onRestore,
  restoringId,
  canEdit,
  canDelete,
  canViewAudit = true,
}: {
  customers: Customer[]
  pagination: CustomerPagination
  loading: boolean
  error: boolean
  onPageChange: (page: number) => void
  onEdit: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onRestore?: (customer: Customer) => void
  restoringId?: string | null
  canEdit: boolean
  canDelete: boolean
  canViewAudit?: boolean
}) {
  const showActions = canEdit || canDelete
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + customers.length - 1, pagination.total) : 0
  const headings = [
    "Customer ID",
    "Customer",
    "Address",
    "Payment terms",
    ...(canViewAudit ? ["Status", "Last change"] : []),
    ...(showActions ? ["Actions"] : []),
  ]

  return (
    <section aria-label="Customer records" className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,39,67,0.05)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Customer directory</h2>
          <p className="mt-0.5 text-xs text-slate-500">Customer accounts, payment terms, and archive status</p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">
          {loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}
        </span>
      </div>

      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {headings.map((heading) => (
                <th key={heading} scope="col" className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pl-6 last:pr-6 ${heading === "Actions" ? "sticky right-0 z-10 border-l border-slate-200 bg-slate-50" : ""}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows showActions={showActions} canViewAudit={canViewAudit} /> : customers.map((customer) => (
              <tr key={customer.id} className={`border-b border-slate-100 transition-colors last:border-0 ${customer.status === "Active" ? "hover:bg-blue-50/40" : "bg-slate-50/70 hover:bg-slate-100"}`}>
                <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">{customer.id}</td>
                <td className="min-w-48 px-5 py-4 text-sm font-semibold text-slate-900">{customer.company}</td>
                <td className="max-w-72 px-5 py-4 text-sm leading-5 text-slate-600">{customer.address}</td>
                <td className="whitespace-nowrap px-5 py-4"><span className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${termStyles[customer.paymentTerm] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{termLabels[customer.paymentTerm] || customer.paymentTerm}</span></td>
                {canViewAudit && <td className="whitespace-nowrap px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${customer.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{customer.status === "Active" ? "Active" : "Archived"}</span></td>}
                {canViewAudit && <td className="max-w-52 px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">{customer.stamp || "—"}</td>}
                {showActions && <td className={`sticky right-0 z-10 border-l border-slate-100 px-5 py-4 pr-6 ${customer.status === "Active" ? "bg-white" : "bg-slate-50"}`}><div className="flex items-center gap-1">
                  {customer.status === "Active" ? <>
                    {canEdit && <button type="button" onClick={() => onEdit(customer)} aria-label={`Edit ${customer.company}`} title="Edit customer" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><EditIcon /></button>}
                    {canDelete && <button type="button" onClick={() => onArchive(customer)} aria-label={`Archive ${customer.company}`} title="Archive customer" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><ArchiveIcon /></button>}
                  </> : canDelete && onRestore ? <button type="button" onClick={() => onRestore(customer)} disabled={restoringId === customer.id} aria-label={`Restore ${customer.company}`} title="Restore customer" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-wait disabled:opacity-50"><RestoreIcon /></button> : <span className="px-2 text-slate-400" aria-label="No actions for archived customer">—</span>}
                </div></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && customers.length === 0 && (
          <div className="border-t border-slate-100 px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-800">No customers found</p>
            <p className="mt-1 text-xs text-slate-500">Try a different search, status, or payment term.</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">
          {loading ? "Loading customer records…" : error ? "Customer records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}
        </p>
        <nav aria-label="Customer table pagination" className="flex items-center gap-1">
          <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white">Previous</button>
          {visiblePages(pagination.page, pagination.totalPages).map((page) => (
            <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-md border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-wait ${page === pagination.page ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{page}</button>
          ))}
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white">Next</button>
        </nav>
      </div>
    </section>
  )
}
