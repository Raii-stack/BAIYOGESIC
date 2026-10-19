import type { Product } from "../../types/product"
import type { SaleLineItem } from "../../types/sale"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function RemoveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  )
}

export default function LineItemsTable({
  lineItems,
  products,
  onChange,
  onRemove,
}: {
  lineItems: SaleLineItem[]
  products: Product[]
  onChange: (id: string, changes: Partial<SaleLineItem>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-100">
            {["Product", "Quantity", "Unit", "Unit Price", "Line Total"].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-5 py-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 ${
                    ["Unit Price", "Line Total"].includes(heading)
                      ? "text-right"
                      : ""
                  }`}
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((lineItem, index) => {
            const product = products.find(
              (item) => item.code === lineItem.productCode,
            )
            const lineTotal = (product?.currentPrice ?? 0) * lineItem.quantity

            return (
              <tr
                key={lineItem.id}
                className={`border-b border-slate-200 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={lineItem.productCode}
                      onChange={(event) =>
                        onChange(lineItem.id, {
                          productCode: event.target.value,
                        })
                      }
                      aria-label={`Product for line ${index + 1}`}
                      className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                    >
                      <option value="">Select product</option>
                      {products.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code} — {item.description}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemove(lineItem.id)}
                      aria-label={`Remove line ${index + 1}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <input
                    type="number"
                    min="1"
                    value={lineItem.quantity}
                    onChange={(event) =>
                      onChange(lineItem.id, {
                        quantity: Math.max(1, Number(event.target.value)),
                      })
                    }
                    aria-label={`Quantity for line ${index + 1}`}
                    className="h-10 w-24 rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  />
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex min-w-12 justify-center border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700">
                    {product?.unitType ?? "—"}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-slate-600">
                  {currency.format(product?.currentPrice ?? 0)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-950">
                  {currency.format(lineTotal)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
