import { Fragment, useState, type ReactNode } from "react"

import type { Product, UnitType } from "../../types/product"

const unitStyles: Record<UnitType, string> = {
  pc: "border-blue-200 bg-blue-50 text-blue-800",
  ea: "border-emerald-200 bg-emerald-50 text-emerald-800",
  mtr: "border-violet-200 bg-violet-50 text-violet-800",
  pkg: "border-amber-200 bg-amber-50 text-amber-800",
  ltr: "border-cyan-200 bg-cyan-50 text-cyan-800",
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </svg>
  )
}

function ActionButton({
  label,
  destructive = false,
  onClick,
  children,
}: {
  label: string
  destructive?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-md text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 ${
        destructive
          ? "hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-600"
          : "hover:bg-blue-50 hover:text-blue-800 focus-visible:ring-blue-700"
      }`}
    >
      {children}
    </button>
  )
}

function PriceHistory({
  product,
  showAdminAudit,
}: {
  product: Product
  showAdminAudit: boolean
}) {
  return (
    <div
      id={`price-history-${product.code}`}
      className="border-l-[3px] border-blue-800 bg-slate-100 px-5 py-5 sm:px-7"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(180px,0.45fr)_minmax(320px,1fr)]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-800">
            Price History
          </p>
          <p className="mt-2 text-sm font-bold text-slate-900">
            {product.code}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Recorded price changes for this product.
          </p>
        </div>
        <div className="overflow-hidden border border-slate-300 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  Effective Date
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  Historical Price
                </th>
                {showAdminAudit && (
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    Stamp
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {product.priceHistory.map((entry) => (
                <tr
                  key={`${product.code}-${entry.effectiveDate}`}
                  className="border-b border-slate-200 last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {entry.effectiveDate}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">
                    {currency.format(entry.price)}
                  </td>
                  {showAdminAudit && (
                    <td className="px-4 py-3 font-mono text-[10px] leading-5 text-slate-500">
                      {entry.stamp ?? "CREATED system 2026-10-01 9:00 AM"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ProductTable({
  products,
  onEdit,
  showAdminAudit = false,
}: {
  products: Product[]
  onEdit: (product: Product) => void
  showAdminAudit?: boolean
}) {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  return (
    <div className="overflow-hidden border border-slate-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {[
                "Product Code",
                "Description",
                "Unit Type",
                "Current Unit Price",
                "Status",
                ...(showAdminAudit ? ["Stamp"] : []),
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-5 py-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 first:pl-6 last:pr-6 ${
                    heading === "Current Unit Price" ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const expanded = expandedProduct === product.code

              return (
                <Fragment key={product.code}>
                  <tr
                    className={`border-b border-slate-200 ${
                      product.status === "Inactive"
                        ? "bg-red-50/70 text-slate-500"
                        : expanded
                          ? "bg-blue-50/60"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50"
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">
                      {product.code}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {product.description}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex min-w-12 justify-center border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${unitStyles[product.unitType]}`}
                      >
                        {product.unitType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-bold tabular-nums text-slate-950">
                          {currency.format(product.currentPrice)}
                        </span>
                        <button
                          type="button"
                          aria-label={`${
                            expanded ? "Hide" : "Show"
                          } price history for ${product.code}`}
                          aria-expanded={expanded}
                          aria-controls={`price-history-${product.code}`}
                          title="Price history"
                          onClick={() =>
                            setExpandedProduct(expanded ? null : product.code)
                          }
                          className={`grid h-8 w-8 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                            expanded
                              ? "bg-blue-800 text-white"
                              : "text-slate-500 hover:bg-blue-50 hover:text-blue-800"
                          }`}
                        >
                          <HistoryIcon />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                          product.status === "Active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    {showAdminAudit && (
                      <td className="max-w-52 px-5 py-4 font-mono text-[10px] leading-5 text-slate-500">
                        {product.stamp}
                      </td>
                    )}
                    <td className="px-5 py-4 pr-6">
                      <div className="flex items-center gap-1">
                        <ActionButton
                          label={`Edit ${product.code}`}
                          onClick={() => onEdit(product)}
                        >
                          <EditIcon />
                        </ActionButton>
                        <ActionButton
                          label={`Delete ${product.code}`}
                          destructive
                        >
                          <DeleteIcon />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-slate-300">
                      <td colSpan={showAdminAudit ? 7 : 6} className="p-0">
                        <PriceHistory
                          product={product}
                          showAdminAudit={showAdminAudit}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-300 px-6 py-4">
        <p className="text-xs font-medium text-slate-600">
          Showing {products.length} products
        </p>
        <p className="hidden text-xs text-slate-500 sm:block">
          Select the history icon to review recorded prices.
        </p>
      </div>
    </div>
  )
}
