import { useEffect, useState, type FormEvent } from "react"

import type { PriceHistoryEntry, Product } from "../../types/product"
import { productApi } from "../../lib/product-api"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import TableSkeleton from "../common/TableSkeleton"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

type PriceHistoryModalProps = {
  product: Product | null
  open: boolean
  onClose: () => void
  canAddPrice: boolean
  canViewAudit?: boolean
  onPriceAdded?: () => void
}

export default function PriceHistoryModal({
  product,
  open,
  onClose,
  canAddPrice,
  canViewAudit = false,
  onPriceAdded,
}: PriceHistoryModalProps) {
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newPrice, setNewPrice] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const productCode = product?.code ?? ""

  useEffect(() => {
    if (!open || !productCode) {
      setEntries([])
      setShowAddForm(false)
      setFormError("")
      setNewPrice("")
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError("")

    productApi
      .priceHistory(productCode, controller.signal)
      .then((prices) => {
        if (!controller.signal.aborted) setEntries(prices)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load price history.")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [open, productCode])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, submitting, onClose])

  if (!open || !product) return null

  const today = new Date().toISOString().slice(0, 10)
  // The active price is the latest effective price with effectiveDate <= today
  const sortedEligible = [...entries]
    .filter((e) => e.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
  const activeDate = sortedEligible[0]?.effectiveDate

  const handleAddPrice = async (event: FormEvent) => {
    event.preventDefault()
    setFormError("")

    const parsedPrice = Number(newPrice.trim())
    if (!newDate) {
      setFormError("Effective date is required.")
      return
    }
    if (!newPrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFormError("Price must be a positive number.")
      return
    }

    setSubmitting(true)
    try {
      await productApi.addPriceHistory(product.code, {
        effdate: newDate,
        price: parsedPrice,
      })
      setNewPrice("")
      setShowAddForm(false)
      const updated = await productApi.priceHistory(product.code)
      setEntries(updated)
      onPriceAdded?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to add price.")
    } finally {
      setSubmitting(false)
    }
  }

  const headings = [
    "Effective Date",
    "Unit Price",
    ...(canViewAudit ? ["Status", "Stamp"] : []),
    "Actions",
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-history-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/45 transition-opacity duration-200"
        aria-hidden="true"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="price-history-modal-title"
              className="text-xl font-bold tracking-tight text-slate-900"
            >
              Price History — {product.code}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{product.description}</span>
              {" · "}
              Unit: <span className="font-medium text-slate-700">{product.unitType}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close price history"
            className="workspace-icon-action"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {canAddPrice && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              {!showAddForm ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Add New Effective Price
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewDate(new Date().toISOString().slice(0, 10))
                      setNewPrice("")
                      setFormError("")
                      setShowAddForm(true)
                    }}
                    className="workspace-primary-action"
                  >
                    <DashboardIcon name="plus" className="h-3.5 w-3.5" />
                    Add Price
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddPrice} noValidate className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      New Price Tier
                    </span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowAddForm(false)}
                      className="workspace-text-action"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="workspace-label">
                        Effective Date
                      </span>
                      <input
                        type="date"
                        value={newDate}
                        disabled={submitting}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="workspace-control"
                      />
                    </label>

                    <label className="block">
                      <span className="workspace-label">
                        Unit Price
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={newPrice}
                          disabled={submitting}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="workspace-control workspace-control--currency"
                        />
                      </div>
                    </label>
                  </div>

                  {formError && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {formError}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowAddForm(false)}
                      className="workspace-secondary-action"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="workspace-primary-action"
                    >
                      {submitting ? "Saving…" : "Save Price"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {loading ? (
            <TableSkeleton
              label="Loading price history"
              headings={headings}
            />
          ) : error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
              No price history recorded.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Effective Date</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    {canViewAudit && (
                      <>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Stamp</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const isActive = entry.effectiveDate === activeDate
                    return (
                      <tr
                        key={entry.effectiveDate}
                        className={isActive ? "bg-emerald-50/60 font-medium" : "hover:bg-slate-50"}
                      >
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {entry.effectiveDate}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                          {currency.format(entry.price)}
                        </td>
                        {canViewAudit && (
                          <>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${
                                  entry.status === "Inactive"
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {entry.status || "Active"}
                              </span>
                            </td>
                            <td className="max-w-[180px] truncate px-4 py-3 font-mono text-[10px] text-slate-500">
                              {entry.stamp || "—"}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-center">
                          {isActive ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Current
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="workspace-secondary-action"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
