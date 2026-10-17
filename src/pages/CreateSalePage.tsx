import { useMemo, useState } from "react"

import CustomerCombobox from "../components/sales/CustomerCombobox"
import LineItemsTable from "../components/sales/LineItemsTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { customers } from "../lib/customers"
import { products } from "../lib/products"
import type { SaleLineItem } from "../types/sale"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function AddIcon() {
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
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export default function CreateSalePage() {
  const [customerId, setCustomerId] = useState("")
  const [saleCompleted, setSaleCompleted] = useState(false)
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([
    { id: "line-1", productCode: "", quantity: 1 },
  ])

  const salesDate = new Intl.DateTimeFormat("en-CA").format(new Date())
  const subtotal = useMemo(
    () =>
      lineItems.reduce((total, lineItem) => {
        const product = products.find(
          (item) => item.code === lineItem.productCode,
        )
        return total + (product?.currentPrice ?? 0) * lineItem.quantity
      }, 0),
    [lineItems],
  )
  const tax = 0
  const grandTotal = subtotal + tax

  const updateLineItem = (id: string, changes: Partial<SaleLineItem>) => {
    setLineItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )
  }

  const addLineItem = () => {
    setLineItems((current) => [
      ...current,
      {
        id: `line-${Date.now()}`,
        productCode: "",
        quantity: 1,
      },
    ])
  }

  const removeLineItem = (id: string) => {
    setLineItems((current) =>
      current.length === 1
        ? [{ ...current[0], productCode: "", quantity: 1 }]
        : current.filter((item) => item.id !== id),
    )
  }

  const canComplete =
    Boolean(customerId) &&
    lineItems.some((lineItem) => Boolean(lineItem.productCode))

  const completeSale = () => {
    setSaleCompleted(true)
    window.setTimeout(() => setSaleCompleted(false), 4000)
  }

  return (
    <DashboardLayout activeNavigation="" searchPlaceholder="Search workspace">
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-7 border-b border-slate-300 pb-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                Sales / Transaction entry
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Create New Sale
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Build a customer sale from current catalog pricing and confirm
                the transaction totals.
              </p>
            </div>

            <section
              aria-labelledby="sale-details-title"
              className="border border-slate-300 border-t-[3px] border-t-blue-800 bg-white"
            >
              <div className="border-b border-slate-300 px-6 py-5 sm:px-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                  01 / Sale details
                </p>
                <h2
                  id="sale-details-title"
                  className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950"
                >
                  Customer and transaction date
                </h2>
              </div>
              <div className="grid gap-5 px-6 py-6 md:grid-cols-[minmax(280px,1fr)_240px] sm:px-8">
                <CustomerCombobox
                  customers={customers}
                  selectedCustomerId={customerId}
                  onSelect={setCustomerId}
                />
                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-700">
                    Sales Date
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={salesDate}
                    className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 font-mono text-sm font-semibold text-slate-600 outline-none"
                  />
                </label>
              </div>
            </section>

            <section
              aria-labelledby="line-items-title"
              className="mt-5 border border-slate-300 bg-white"
            >
              <div className="px-6 py-5 sm:px-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                  02 / Line items
                </p>
                <h2
                  id="line-items-title"
                  className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950"
                >
                  Products and quantities
                </h2>
              </div>

              <LineItemsTable
                lineItems={lineItems}
                products={products}
                onChange={updateLineItem}
                onRemove={removeLineItem}
              />

              <div className="border-t border-slate-200 px-6 py-4 sm:px-8">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                >
                  <AddIcon />
                  Add Item
                </button>
              </div>
            </section>

            <section
              aria-labelledby="sale-summary-title"
              className="ml-auto mt-5 w-full border border-slate-300 bg-white md:max-w-md"
            >
              <div className="border-b border-slate-300 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                  03 / Review
                </p>
                <h2
                  id="sale-summary-title"
                  className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950"
                >
                  Summary
                </h2>
              </div>
              <dl className="space-y-3 px-6 py-5 text-sm">
                <div className="flex items-center justify-between gap-6">
                  <dt className="text-slate-600">Subtotal</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {currency.format(subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <dt className="text-slate-600">Tax</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {currency.format(tax)}
                  </dd>
                </div>
                <div className="flex items-end justify-between gap-6 border-t border-slate-300 pt-4">
                  <dt className="font-bold text-slate-950">Grand Total</dt>
                  <dd className="text-2xl font-bold tracking-[-0.03em] tabular-nums text-slate-950">
                    {currency.format(grandTotal)}
                  </dd>
                </div>
              </dl>
              <div className="border-t border-slate-300 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  disabled={!canComplete}
                  onClick={completeSale}
                  className="h-11 w-full rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  Complete Sale
                </button>
              </div>
            </section>
          </div>
        </main>

        {saleCompleted && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-50 flex w-[calc(100%-2.5rem)] max-w-sm items-start gap-3 border border-emerald-300 border-l-[3px] border-l-emerald-600 bg-white px-4 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="8" />
              <path d="m6.5 10 2.2 2.2 4.8-5" />
            </svg>
            <div>
              <p className="text-sm font-bold text-slate-950">Sale completed</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                The sale has been recorded successfully.
              </p>
            </div>
          </div>
        )}
      </>
    </DashboardLayout>
  )
}
