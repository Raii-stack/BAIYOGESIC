import { memo } from "react"
import { TableSkeletonRows } from "../common/TableSkeleton"
import type { Customer } from "../../types/customer"
import type { CustomerPagination, CustomerSortBy } from "../../lib/customer-api"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import RecordEmptyState from "../common/RecordEmptyState"
import SortableColumnHeader from "../common/SortableColumnHeader"
import { PAGE_SIZE_OPTIONS, type PageSize, type SortOrder } from "../../lib/table-sorting"

const termLabels: Record<Customer["paymentTerm"], string> = {
  "30D": "Net 30",
  "45D": "Net 45",
  "60D": "Net 60",
  COD: "COD",
}

function visiblePages(page: number, totalPages: number) {
  const count = Math.min(totalPages, 5)
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1))
  return Array.from({ length: count }, (_, index) => start + index)
}

type CustomerTableRowProps = {
  customer: Customer
  canViewAudit: boolean
  showActions: boolean
  canEdit: boolean
  canDelete: boolean
  onEdit: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onRestore?: (customer: Customer) => void
  restoringId?: string | null
}

const CustomerTableRow = memo(function CustomerTableRow({
  customer,
  canViewAudit,
  showActions,
  canEdit,
  canDelete,
  onEdit,
  onArchive,
  onRestore,
  restoringId,
}: CustomerTableRowProps) {
  return (
    <tr
      className={`border-b border-slate-100 transition-colors last:border-0 ${
        customer.status === "Active" ? "hover:bg-neutral-50" : "is-muted"
      }`}
    >
      <td data-label="Customer ID" className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600">
        {customer.id}
      </td>
      <td data-label="Customer" className="min-w-48 text-[13px] font-medium text-neutral-900">
        {customer.company}
      </td>
      <td data-label="Address" className="max-w-72 text-sm leading-5 text-slate-600">
        {customer.address}
      </td>
      <td data-label="Payment terms" className="whitespace-nowrap">
        <span className="workspace-badge workspace-badge--neutral" data-term={customer.paymentTerm}>
          {termLabels[customer.paymentTerm] || customer.paymentTerm}
        </span>
      </td>
      {canViewAudit && (
        <td data-label="Status" className="whitespace-nowrap">
          <span
            className={`workspace-badge ${
              customer.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {customer.status === "Active" ? "Active" : "Archived"}
          </span>
        </td>
      )}
      {canViewAudit && (
        <td data-label="Last change" className="max-w-52 font-mono text-[11px] leading-5 text-slate-500">
          {customer.stamp || "—"}
        </td>
      )}
      {showActions && (
        <td
          data-label="Actions"
          className={`workspace-table-actions ${customer.status === "Active" ? "bg-white" : "bg-slate-50"}`}
        >
          <div className="flex items-center gap-1">
            {customer.status === "Active" ? (
              <>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(customer)}
                    aria-label={`Edit ${customer.company}`}
                    title="Edit customer"
                    className="workspace-icon-action"
                  >
                    <DashboardIcon name="edit" className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onArchive(customer)}
                    aria-label={`Archive ${customer.company}`}
                    title="Archive customer"
                    className="workspace-icon-action workspace-icon-action--danger"
                  >
                    <DashboardIcon name="archive" className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : canDelete && onRestore ? (
              <button
                type="button"
                onClick={() => onRestore(customer)}
                disabled={restoringId === customer.id}
                aria-label={`Restore ${customer.company}`}
                title="Restore customer"
                className="workspace-icon-action"
              >
                <DashboardIcon name="restore" className="h-4 w-4" />
              </button>
            ) : (
              <span className="px-2 text-slate-400" aria-label="No actions for archived customer">
                —
              </span>
            )}
          </div>
        </td>
      )}
    </tr>
  )
})

export default function CustomerTable({
  customers,
  pagination,
  loading,
  error,
  onPageChange,
  pageSize,
  onLimitChange,
  sortBy,
  sortOrder,
  onSortChange,
  onEdit,
  onArchive,
  onRestore,
  restoringId,
  canEdit,
  canDelete,
  canAdd,
  canViewAudit = true,
  hasFilters,
  onClearFilters,
  onAdd,
}: {
  customers: Customer[]
  pagination: CustomerPagination
  loading: boolean
  error: boolean
  onPageChange: (page: number) => void
  pageSize: PageSize
  onLimitChange: (limit: PageSize) => void
  sortBy: CustomerSortBy
  sortOrder: SortOrder
  onSortChange: (sortBy: CustomerSortBy) => void
  onEdit: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onRestore?: (customer: Customer) => void
  restoringId?: string | null
  canEdit: boolean
  canDelete: boolean
  canAdd: boolean
  canViewAudit?: boolean
  hasFilters: boolean
  onClearFilters: () => void
  onAdd: () => void
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
        <table role="table" className="workspace-table min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {headings.map((heading) => {
                if (heading === "Customer ID") return <SortableColumnHeader key={heading} label={heading} active={sortBy === "customerId"} order={sortOrder} onSort={() => onSortChange("customerId")} />
                if (heading === "Customer") return <SortableColumnHeader key={heading} label={heading} active={sortBy === "customer"} order={sortOrder} onSort={() => onSortChange("customer")} />
                return <th key={heading} scope="col" className={`workspace-table-heading ${heading === "Actions" ? "workspace-table-actions" : ""}`}>{heading}</th>
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows headings={headings} />
            ) : (
              customers.map((customer) => (
                <CustomerTableRow
                  key={customer.id}
                  customer={customer}
                  canViewAudit={canViewAudit}
                  showActions={showActions}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  restoringId={restoringId}
                />
              ))
            )}
          </tbody>
        </table>
        {!loading && !error && customers.length === 0 && <RecordEmptyState kind="customers" filtered={hasFilters} canCreate={canAdd} onClearFilters={onClearFilters} onCreate={onAdd} />}
      </div>

      <div className="workspace-table-footer">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">
          {loading ? "Loading customer records…" : error ? "Customer records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}
        </p>
        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>Rows per page</span>
            <select aria-label="Customer rows per page" value={pageSize} onChange={(event) => onLimitChange(Number(event.target.value) as PageSize)} disabled={loading} className="workspace-control workspace-page-size">
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <nav aria-label="Customer table pagination" className="workspace-pagination">
            <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1}>Previous</button>
            {visiblePages(pagination.page, pagination.totalPages).map((page) => (
              <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined}>{page}</button>
            ))}
            <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>Next</button>
          </nav>
        </div>
      </div>
    </section>
  )
}
