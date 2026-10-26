import type { Customer } from "../../types/customer"
import type { CustomerPagination } from "../../lib/customer-api"

const termLabels: Record<Customer["paymentTerm"], string> = {
  "30D": "Net 30",
  "45D": "Net 45",
  "60D": "Net 60",
  COD: "Cash on delivery",
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
        <td key={column}>
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
    <section aria-label="Customer records" className="workspace-panel">
      <div className="workspace-table-header">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Customer directory</h2>
          <p className="mt-0.5 text-xs text-slate-500">Customer accounts, payment terms, and archive status</p>
        </div>
        <span className="workspace-badge workspace-badge--neutral">
          {loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}
        </span>
      </div>

      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="workspace-table min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {headings.map((heading) => (
                <th key={heading} scope="col" className={`workspace-table-heading ${heading === "Actions" ? "workspace-table-actions" : ""}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows showActions={showActions} canViewAudit={canViewAudit} /> : customers.map((customer) => (
              <tr key={customer.id} className={`border-b border-slate-100 transition-colors last:border-0 ${customer.status === "Active" ? "hover:bg-neutral-50" : "is-muted"}`}>
                <td className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600">{customer.id}</td>
                <td className="min-w-48 text-[13px] font-medium text-neutral-900">{customer.company}</td>
                <td className="max-w-72 text-sm leading-5 text-slate-600">{customer.address}</td>
                <td className="whitespace-nowrap"><span className="workspace-badge workspace-badge--neutral" data-term={customer.paymentTerm}>{termLabels[customer.paymentTerm] || customer.paymentTerm}</span></td>
                {canViewAudit && <td className="whitespace-nowrap"><span className={`workspace-badge ${customer.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>{customer.status === "Active" ? "Active" : "Archived"}</span></td>}
                {canViewAudit && <td className="max-w-52 font-mono text-[11px] leading-5 text-slate-500">{customer.stamp || "—"}</td>}
                {showActions && <td className={`workspace-table-actions ${customer.status === "Active" ? "bg-white" : "bg-slate-50"}`}><div className="flex items-center gap-1">
                  {customer.status === "Active" ? <>
                    {canEdit && <button type="button" onClick={() => onEdit(customer)} aria-label={`Edit ${customer.company}`} title="Edit customer" className="workspace-icon-action"><EditIcon /></button>}
                    {canDelete && <button type="button" onClick={() => onArchive(customer)} aria-label={`Archive ${customer.company}`} title="Archive customer" className="workspace-icon-action workspace-icon-action--danger"><ArchiveIcon /></button>}
                  </> : canDelete && onRestore ? <button type="button" onClick={() => onRestore(customer)} disabled={restoringId === customer.id} aria-label={`Restore ${customer.company}`} title="Restore customer" className="workspace-icon-action"><RestoreIcon /></button> : <span className="px-2 text-slate-400" aria-label="No actions for archived customer">—</span>}
                </div></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && customers.length === 0 && (
          <div className="workspace-empty-state">
            <p className="text-sm font-semibold text-slate-800">No customers found</p>
            <p className="mt-1 text-xs text-slate-500">Try a different search, status, or payment term.</p>
          </div>
        )}
      </div>

      <div className="workspace-table-footer">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">
          {loading ? "Loading customer records…" : error ? "Customer records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}
        </p>
        <nav aria-label="Customer table pagination" className="workspace-pagination">
          <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1}>Previous</button>
          {visiblePages(pagination.page, pagination.totalPages).map((page) => (
            <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined}>{page}</button>
          ))}
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>Next</button>
        </nav>
      </div>
    </section>
  )
}
