import { Fragment, useEffect, useState } from "react"

import { productApi, type ProductPagination } from "../../lib/product-api"
import type { PriceHistoryEntry, Product, UnitType } from "../../types/product"

const unitStyles: Record<UnitType, string> = {
  pc: "border-blue-200 bg-blue-50 text-blue-800",
  ea: "border-emerald-200 bg-emerald-50 text-emerald-800",
  mtr: "border-violet-200 bg-violet-50 text-violet-800",
  pkg: "border-amber-200 bg-amber-50 text-amber-900",
  ltr: "border-cyan-200 bg-cyan-50 text-cyan-800",
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function HistoryIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" /></svg>
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" /></svg>
}

function ArchiveIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>
}

function SkeletonRows({ showActions }: { showActions: boolean }) {
  return Array.from({ length: 8 }, (_, index) => (
    <tr key={index} aria-hidden="true" className="border-b border-slate-100 last:border-0">
      {["w-20", "w-44", "w-12", "w-24", "w-20", "w-16", "w-36", ...(showActions ? ["w-16"] : [])].map((width, column) => (
        <td key={column} className="px-5 py-5 first:pl-6 last:pr-6"><div className={`h-3.5 ${width} max-w-full animate-pulse rounded bg-slate-200`} /></td>
      ))}
    </tr>
  ))
}

function PriceHistory({ code }: { code: string }) {
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
    <div id={`price-history-${code}`} className="border-l-[3px] border-blue-800 bg-slate-50 px-5 py-5 sm:px-7">
      <div className="grid gap-5 lg:grid-cols-[minmax(180px,0.45fr)_minmax(320px,1fr)]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-800">Price history</p>
          <p className="mt-2 font-mono text-sm font-bold text-slate-900">{code}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Recorded effective prices for this product.</p>
        </div>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-busy={loading}>
          {loading ? <div className="space-y-3 p-4" aria-label="Loading price history">{[0, 1, 2].map((item) => <div key={item} className="h-4 animate-pulse rounded bg-slate-200" />)}</div>
            : error ? <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Retry</button></div>
              : entries.length === 0 ? <p className="p-4 text-sm text-slate-500">No price history recorded.</p>
                : <table className="w-full text-left">
                  <thead><tr className="border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><th className="px-4 py-3">Effective date</th><th className="px-4 py-3 text-right">Unit price</th><th className="hidden px-4 py-3 sm:table-cell">Last change</th></tr></thead>
                  <tbody>{entries.map((entry) => <tr key={entry.effectiveDate} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-mono text-xs text-slate-600">{entry.effectiveDate}</td><td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">{currency.format(entry.price)}</td><td className="hidden px-4 py-3 font-mono text-[11px] text-slate-500 sm:table-cell">{entry.stamp || "—"}</td></tr>)}</tbody>
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

export default function ProductTable({ products, pagination, loading, error, onPageChange, onEdit, onArchive, canEdit, canDelete }: {
  products: Product[]
  pagination: ProductPagination
  loading: boolean
  error: boolean
  onPageChange: (page: number) => void
  onEdit: (product: Product) => void
  onArchive: (product: Product) => void
  canEdit: boolean
  canDelete: boolean
}) {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const showActions = canEdit || canDelete
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + products.length - 1, pagination.total) : 0

  return (
    <section aria-label="Product records" className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,39,67,0.05)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div><h2 className="text-sm font-bold text-slate-900">Product catalog</h2><p className="mt-0.5 text-xs text-slate-500">Products, effective prices, and archive status</p></div>
        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}</span>
      </div>
      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="w-full min-w-[1030px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            {["Product code", "Description", "Unit", "Unit price", "Effective", "Status", "Last change", ...(showActions ? ["Actions"] : [])].map((heading) => <th key={heading} scope="col" className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pl-6 last:pr-6 ${heading === "Unit price" ? "text-right" : ""} ${heading === "Actions" ? "sticky right-0 z-10 border-l border-slate-200 bg-slate-50" : ""}`}>{heading}</th>)}
          </tr></thead>
          <tbody>{loading ? <SkeletonRows showActions={showActions} /> : products.map((product) => {
            const expanded = expandedProduct === product.code
            return <Fragment key={product.code}>
              <tr className={`border-b border-slate-100 transition-colors ${expanded ? "bg-blue-50/60" : product.status === "Active" ? "hover:bg-blue-50/40" : "bg-slate-50/70 hover:bg-slate-100"}`}>
                <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">{product.code}</td>
                <td className="min-w-48 px-5 py-4 text-sm font-semibold text-slate-900">{product.description}</td>
                <td className="px-5 py-4"><span className={`inline-flex min-w-12 justify-center rounded border px-2.5 py-1 text-xs font-bold uppercase ${unitStyles[product.unitType] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{product.unitType}</span></td>
                <td className="whitespace-nowrap px-5 py-4"><div className="flex items-center justify-end gap-2"><span className="text-sm font-bold tabular-nums text-slate-950">{product.currentPrice === null ? "No price" : currency.format(product.currentPrice)}</span><button type="button" aria-label={`${expanded ? "Hide" : "Show"} price history for ${product.code}`} aria-expanded={expanded} aria-controls={`price-history-${product.code}`} title="Price history" onClick={() => setExpandedProduct(expanded ? null : product.code)} className={`grid h-8 w-8 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${expanded ? "bg-blue-800 text-white" : "text-slate-500 hover:bg-blue-100 hover:text-blue-800"}`}><HistoryIcon /></button></div></td>
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{product.priceEffectiveDate || "—"}</td>
                <td className="whitespace-nowrap px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${product.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{product.status === "Active" ? "Active" : "Archived"}</span></td>
                <td className="max-w-52 px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">{product.stamp || "—"}</td>
                {showActions && <td className={`sticky right-0 z-10 border-l border-slate-100 px-5 py-4 pr-6 ${product.status === "Active" ? "bg-white" : "bg-slate-50"}`}><div className="flex items-center gap-1">
                  {product.status === "Active" ? <>
                    {canEdit && <button type="button" onClick={() => onEdit(product)} aria-label={`Edit ${product.code}`} title="Edit product" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><EditIcon /></button>}
                    {canDelete && <button type="button" onClick={() => onArchive(product)} aria-label={`Archive ${product.code}`} title="Archive product" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><ArchiveIcon /></button>}
                  </> : <span className="px-2 text-slate-400" aria-label="No actions for archived product">—</span>}
                </div></td>}
              </tr>
              {expanded && <tr className="border-b border-slate-200"><td colSpan={showActions ? 8 : 7} className="p-0"><PriceHistory code={product.code} /></td></tr>}
            </Fragment>
          })}</tbody>
        </table>
        {!loading && !error && products.length === 0 && <div className="border-t border-slate-100 px-6 py-14 text-center"><p className="text-sm font-semibold text-slate-800">No products found</p><p className="mt-1 text-xs text-slate-500">Try a different search, status, or unit filter.</p></div>}
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">{loading ? "Loading product records…" : error ? "Product records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}</p>
        <nav aria-label="Product table pagination" className="flex items-center gap-1">
          <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-400">Previous</button>
          {visiblePages(pagination.page, pagination.totalPages).map((page) => <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-md border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${page === pagination.page ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{page}</button>)}
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-400">Next</button>
        </nav>
      </div>
    </section>
  )
}
