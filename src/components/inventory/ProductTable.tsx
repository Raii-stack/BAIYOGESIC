import TableSkeleton, { TableSkeletonRows } from "../common/TableSkeleton"
import { Fragment, useEffect, useState } from "react"

import { DashboardIcon } from "../dashboard/DashboardComponents"
import RecordEmptyState from "../common/RecordEmptyState"
import { productApi, type ProductPagination } from "../../lib/product-api"
import type { PriceHistoryEntry, Product } from "../../types/product"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function PriceHistory({ code, canViewAudit }: { code: string; canViewAudit: boolean }) {
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    productApi.priceHistory(code, controller.signal)
      .then((prices) => { if (!controller.signal.aborted) setEntries(prices) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load prices.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [code, retry])

  return (
    <div id={`price-history-${code}`} className="workspace-history">
      <div className="grid gap-5 lg:grid-cols-[minmax(180px,0.45fr)_minmax(320px,1fr)]">
        <div>
          <p className="text-sm font-semibold text-neutral-700">Price history</p>
          <p className="mt-2 font-mono text-sm font-semibold text-neutral-900">{code}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Recorded effective prices for this product.</p>
        </div>
        <div className="workspace-panel" aria-busy={loading}>
          {loading ? <TableSkeleton label="Loading price history" headings={["Effective date", "Unit price", ...(canViewAudit ? ["Last change"] : [])]} />
            : error ? <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Retry</button></div>
              : entries.length === 0 ? <p className="p-4 text-sm text-slate-500">No price history recorded.</p>
                : <table role="table" className="workspace-table">
                  <thead><tr className="border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><th className="px-4 py-3">Effective date</th><th className="px-4 py-3 text-right">Unit price</th>{canViewAudit && <th className="px-4 py-3 sm:table-cell">Last change</th>}</tr></thead>
                  <tbody>{entries.map((entry) => <tr key={entry.effectiveDate} className="border-b border-slate-100 last:border-0"><td data-label="Effective date" className="px-4 py-3 font-mono text-xs text-slate-600">{entry.effectiveDate}</td><td data-label="Unit price" className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">{currency.format(entry.price)}</td>{canViewAudit && <td data-label="Last change" className="px-4 py-3 font-mono text-[11px] text-slate-500 sm:table-cell">{entry.stamp || "—"}</td>}</tr>)}</tbody>
                </table>}
        </div>
      </div>
    </div>
  )
}

function visiblePages(page: number, totalPages: number) {
  const count = Math.min(totalPages, 5)
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1))
  return Array.from({ length: count }, (_, index) => start + index)
}

export default function ProductTable({ products, pagination, loading, error, onPageChange, onEdit, onArchive, onRestore, restoringCode, canEdit, canDelete, canAdd, canViewAudit = true, hasFilters, onClearFilters, onAdd }: {
  products: Product[]
  pagination: ProductPagination
  loading: boolean
  error: boolean
  onPageChange: (page: number) => void
  onEdit: (product: Product) => void
  onArchive: (product: Product) => void
  onRestore?: (product: Product) => void
  restoringCode?: string | null
  canEdit: boolean
  canDelete: boolean
  canAdd: boolean
  canViewAudit?: boolean
  hasFilters: boolean
  onClearFilters: () => void
  onAdd: () => void
}) {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const showActions = canEdit || canDelete
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + products.length - 1, pagination.total) : 0
  const headings = [
    "Product code",
    "Description",
    "Unit",
    "Unit price",
    "Effective",
    ...(canViewAudit ? ["Status", "Last change"] : []),
    ...(showActions ? ["Actions"] : []),
  ]

  return (
    <section aria-label="Product records" className="workspace-panel">
      <div className="workspace-table-header">
        <div><h2 className="text-sm font-semibold text-neutral-900">Product catalog</h2><p className="mt-0.5 text-xs text-slate-500">Products, effective prices, and archive status</p></div>
        <span className="workspace-badge workspace-badge--neutral">{loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}</span>
      </div>
      <div className="overflow-x-auto" aria-busy={loading}>
        <table role="table" className="workspace-table min-w-[820px]">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            {headings.map((heading) => <th key={heading} scope="col" className={`workspace-table-heading ${heading === "Unit price" ? "text-right" : ""} ${heading === "Actions" ? "workspace-table-actions" : ""}`}>{heading}</th>)}
          </tr></thead>
          <tbody>{loading ? <TableSkeletonRows headings={headings} /> : products.map((product) => {
            const expanded = expandedProduct === product.code
            return <Fragment key={product.code}>
              <tr className={`border-b border-slate-100 transition-colors ${expanded ? "is-expanded" : product.status === "Active" ? "hover:bg-neutral-50" : "is-muted"}`}>
                <td data-label="Product code" className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600">{product.code}</td>
                <td data-label="Description" className="min-w-48 text-[13px] font-medium text-neutral-900">{product.description}</td>
                <td data-label="Unit"><span className="workspace-badge workspace-badge--neutral" data-unit={product.unitType}>{product.unitType}</span></td>
                <td data-label="Unit price" className="whitespace-nowrap"><div className="flex items-center justify-end gap-2"><span className="text-[13px] font-semibold tabular-nums text-neutral-900">{product.currentPrice === null ? "No price" : currency.format(product.currentPrice)}</span><button type="button" aria-label={`${expanded ? "Hide" : "Show"} price history for ${product.code}`} aria-expanded={expanded} aria-controls={`price-history-${product.code}`} title="Price history" onClick={() => setExpandedProduct(expanded ? null : product.code)} className="workspace-icon-action"><DashboardIcon name="history" className="h-4 w-4" /></button></div></td>
                <td data-label="Effective" className="whitespace-nowrap font-mono text-xs text-slate-600">{product.priceEffectiveDate || "—"}</td>
                {canViewAudit && <td data-label="Status" className="whitespace-nowrap"><span className={`workspace-badge ${product.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>{product.status === "Active" ? "Active" : "Archived"}</span></td>}
                {canViewAudit && <td data-label="Last change" className="max-w-52 font-mono text-[11px] leading-5 text-slate-500">{product.stamp || "—"}</td>}
                {showActions && <td data-label="Actions" className={`workspace-table-actions ${product.status === "Active" ? "bg-white" : "bg-slate-50"}`}><div className="flex items-center gap-1">
                  {product.status === "Active" ? <>
                    {canEdit && <button type="button" onClick={() => onEdit(product)} aria-label={`Edit ${product.code}`} title="Edit product" className="workspace-icon-action"><DashboardIcon name="edit" className="h-4 w-4" /></button>}
                    {canDelete && <button type="button" onClick={() => onArchive(product)} aria-label={`Archive ${product.code}`} title="Archive product" className="workspace-icon-action workspace-icon-action--danger"><DashboardIcon name="archive" className="h-4 w-4" /></button>}
                  </> : canDelete && onRestore ? <button type="button" onClick={() => onRestore(product)} disabled={restoringCode === product.code} aria-label={`Restore ${product.code}`} title="Restore product" className="workspace-icon-action"><DashboardIcon name="restore" className="h-4 w-4" /></button> : <span className="px-2 text-slate-400" aria-label="No actions for archived product">—</span>}
                </div></td>}
              </tr>
              {expanded && <tr className="border-b border-slate-200"><td colSpan={headings.length} className="workspace-table-expansion"><PriceHistory code={product.code} canViewAudit={canViewAudit} /></td></tr>}
            </Fragment>
          })}</tbody>
        </table>
        {!loading && !error && products.length === 0 && <RecordEmptyState kind="products" filtered={hasFilters} canCreate={canAdd} onClearFilters={onClearFilters} onCreate={onAdd} />}
      </div>
      <div className="workspace-table-footer">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">{loading ? "Loading product records…" : error ? "Product records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}</p>
        <nav aria-label="Product table pagination" className="workspace-pagination">
          <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1}>Previous</button>
          {visiblePages(pagination.page, pagination.totalPages).map((page) => <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined}>{page}</button>)}
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>Next</button>
        </nav>
      </div>
    </section>
  )
}
