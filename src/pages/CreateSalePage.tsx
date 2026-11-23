import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import ConfirmSaleModal from "../components/sales/ConfirmSaleModal"
import CustomerCombobox from "../components/sales/CustomerCombobox"
import EmployeeCombobox from "../components/sales/EmployeeCombobox"
import ProductCombobox from "../components/sales/ProductCombobox"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import DashboardLayout from "../layouts/DashboardLayout"
import {
  getLineSubtotal,
  lookupPriceAsOfDate,
  roundCurrency,
} from "../lib/sales"
import { salesApi } from "../lib/sales-api"
import { notifyToast } from "../lib/toast"
import type { Customer } from "../types/customer"
import type { Employee } from "../types/employee"
import type { SaleCatalogProduct } from "../types/sale"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

type DraftLineItem = {
  id: string
  productCode: string
  quantity: string
  unitPrice: number
}

function resolveProductPrice(
  products: SaleCatalogProduct[],
  productCode: string,
  salesDate: string,
): number {
  const product = products.find((entry) => entry.code === productCode)
  if (!product) return 0
  const resolved = lookupPriceAsOfDate(
    product.priceHistory,
    salesDate,
    product.currentPrice,
  )
  return resolved ?? product.currentPrice ?? 0
}

export default function CreateSalePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const employeeDefaultApplied = useRef(false)
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([])
  const [productOptions, setProductOptions] = useState<SaleCatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [catalogRetry, setCatalogRetry] = useState(0)

  const [transactionNo, setTransactionNo] = useState("Auto-numbered on save")
  const [salesDate, setSalesDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA").format(new Date()),
  )
  const [customerId, setCustomerId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [lines, setLines] = useState<DraftLineItem[]>([])
  const [lineFeedback, setLineFeedback] = useState("")
  const [pendingFocusLineId, setPendingFocusLineId] = useState<string | null>(null)
  const productSelectRefs = useRef<Record<string, HTMLSelectElement | null>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setCatalogLoading(true)
    setCatalogError("")
    salesApi
      .catalog(controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted) return
        setCustomerOptions(catalog.customers)
        setEmployeeOptions(catalog.employees)
        setProductOptions(catalog.products)
        if (catalog.products.length > 0) {
          setLines((current) =>
            current.map((line) =>
              line.productCode && catalog.products.some((p) => p.code === line.productCode)
                ? {
                    ...line,
                    unitPrice: resolveProductPrice(
                      catalog.products,
                      line.productCode,
                      salesDate,
                    ),
                  }
                : line,
            ),
          )
        }
      })
      .catch((error) => { if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : "Unable to load the sales catalog.") })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [catalogRetry])

  useEffect(() => {
    const employeeNumber = user?.empno
    if (employeeDefaultApplied.current || catalogLoading || catalogError || !employeeNumber) return
    employeeDefaultApplied.current = true
    if (employeeOptions.some((employee) => employee.id === employeeNumber)) {
      setEmployeeId((current) => current || employeeNumber)
    }
  }, [catalogError, catalogLoading, employeeOptions, user?.empno])

  useEffect(() => {
    if (!pendingFocusLineId) return
    productSelectRefs.current[pendingFocusLineId]?.focus()
    setPendingFocusLineId(null)
  }, [pendingFocusLineId, lines])

  const usedProductCodes = useMemo(
    () => new Set(lines.map((line) => line.productCode).filter(Boolean)),
    [lines],
  )

  const refreshLinePrice = (
    lineId: string,
    productCode: string,
    targetDate: string,
  ) => {
    if (!productCode) return
    salesApi
      .lookupPrice(productCode, targetDate)
      .then((lookup) => {
        if (!lookup) return
        setLines((current) =>
          current.map((entry) =>
            entry.id === lineId && entry.productCode === productCode
              ? { ...entry, unitPrice: lookup.unitPrice }
              : entry,
          ),
        )
      })
      .catch(() => {})
  }

  const handleSalesDateChange = (nextDate: string) => {
    setSalesDate(nextDate)
    setFormError("")
    setLines((current) =>
      current.map((line) => ({
        ...line,
        unitPrice: line.productCode
          ? resolveProductPrice(productOptions, line.productCode, nextDate)
          : 0,
      })),
    )

    lines.forEach((line) => {
      if (line.productCode) refreshLinePrice(line.id, line.productCode, nextDate)
    })
  }

  const handleProductChange = (lineId: string, productCode: string) => {
    setFormError("")
    setLineFeedback("")
    if (!productCode) {
      setLines((current) => current.filter((line) => line.id !== lineId))
      return
    }
    const localPrice = resolveProductPrice(productOptions, productCode, salesDate)
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? { ...line, productCode, unitPrice: localPrice }
          : line,
      ),
    )

    refreshLinePrice(lineId, productCode, salesDate)
  }

  const handleQuickAddProduct = (productCode: string) => {
    const product = productOptions.find((entry) => entry.code === productCode)
    if (!product) return
    setFormError("")

    const existing = lines.find((line) => line.productCode === productCode)
    if (existing) {
      const currentQty = Number(existing.quantity)
      const nextQty =
        (Number.isFinite(currentQty) && currentQty > 0 ? currentQty : 0) + 1
      setLines((current) =>
        current.map((line) =>
          line.id === existing.id
            ? { ...line, quantity: String(nextQty) }
            : line,
        ),
      )
      setLineFeedback(
        `Increased ${product.description} (${product.code}) quantity to ${nextQty}.`,
      )
      return
    }

    const localPrice = resolveProductPrice(productOptions, productCode, salesDate)
    const emptyLine = lines.find((line) => !line.productCode)
    if (emptyLine) {
      setLines((current) =>
        current.map((line) =>
          line.id === emptyLine.id
            ? { ...line, productCode, quantity: "1", unitPrice: localPrice }
            : line,
        ),
      )
      refreshLinePrice(emptyLine.id, productCode, salesDate)
      setLineFeedback(`Added ${product.description} (${product.code}).`)
      return
    }

    const newId = `line-${Date.now()}-${lines.length + 1}`
    setLines((current) => [
      ...current,
      { id: newId, productCode, quantity: "1", unitPrice: localPrice },
    ])
    refreshLinePrice(newId, productCode, salesDate)
    setLineFeedback(`Added ${product.description} (${product.code}).`)
  }

  const handleQuantityChange = (lineId: string, quantity: string) => {
    setFormError("")
    setLines((current) =>
      current.map((line) =>
        line.id === lineId ? { ...line, quantity } : line,
      ),
    )
  }

  const addLineItem = () => {
    setFormError("")
    setLineFeedback("")
    const newId = `line-${Date.now()}-${lines.length + 1}`
    setLines((current) => [
      ...current,
      {
        id: newId,
        productCode: "",
        quantity: "1",
        unitPrice: 0,
      },
    ])
    setPendingFocusLineId(newId)
  }

  const removeLineItem = (lineId: string) => {
    setFormError("")
    setLineFeedback("")
    setLines((current) => current.filter((line) => line.id !== lineId))
  }

  const { subtotal, tax, totalAmount } = useMemo(() => {
    const computedSubtotal = roundCurrency(
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity)
        if (!Number.isFinite(qty) || qty <= 0) return sum
        return roundCurrency(sum + getLineSubtotal(qty, line.unitPrice))
      }, 0),
    )
    const computedTax = 0
    return {
      subtotal: computedSubtotal,
      tax: computedTax,
      totalAmount: roundCurrency(computedSubtotal + computedTax),
    }
  }, [lines])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFormError("")
    if (catalogLoading || catalogError) return

    if (!customerId || !employeeId) {
      setFormError("Select both a customer and a salesperson.")
      return
    }

    if (lines.length === 0) {
      setFormError("Add at least one line item.")
      return
    }

    const seenProducts = new Set<string>()
    for (const line of lines) {
      if (!line.productCode) {
        setFormError("Select a product for every line item.")
        return
      }
      if (seenProducts.has(line.productCode)) {
        setFormError(`Duplicate product ${line.productCode} in line items.`)
        return
      }
      seenProducts.add(line.productCode)

      const numericQty = Number(line.quantity)
      if (!Number.isFinite(numericQty) || numericQty <= 0) {
        setFormError("Quantity must be greater than zero.")
        return
      }
    }

    setConfirmOpen(true)
  }

  const confirmCreateSale = async () => {
    setFormError("")
    setSubmitting(true)
    try {
      const created = await salesApi.create({
        custno: customerId,
        empno: employeeId,
        salesdate: salesDate,
        lines: lines.map((line) => ({
          prodcode: line.productCode,
          quantity: Number(line.quantity),
          unitprice: line.unitPrice,
        })),
      })

      setTransactionNo(created.transactionNo)
      setConfirmOpen(false)
      notifyToast(`Sales order ${created.transactionNo} created.`, "success")
      navigate("/sales?view=transactions&page=1")
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to save sales transaction."
      setFormError(message)
      notifyToast(message, "error")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCustomer = customerOptions.find((entry) => entry.id === customerId)
  const selectedEmployee = employeeOptions.find((entry) => entry.id === employeeId)
  const confirmLines = lines.map((line) => {
    const product = productOptions.find((entry) => entry.code === line.productCode)
    const qty = Number(line.quantity)
    const validQty = Number.isFinite(qty) && qty > 0 ? qty : 0
    return {
      id: line.id,
      productCode: line.productCode,
      description: product?.description ?? line.productCode,
      unit: product?.unit ?? "pc",
      quantity: validQty,
      unitPrice: line.unitPrice,
      subtotal: getLineSubtotal(validQty, line.unitPrice),
    }
  })

  return (
    <DashboardLayout
      activeNavigation="Sales"
      searchPlaceholder="Search workspace"
    >
      <main className="workspace-page">
        <div className="mx-auto max-w-7xl">
          <header className="workspace-page-header">
            <div>
              <h1 className="workspace-page-title">Create sale</h1>
              <p className="workspace-page-description">
                Choose a customer, assign the salesperson, and add product line items with effective unit pricing.
              </p>
            </div>
          </header>

          {catalogLoading && <p role="status" className="mb-4 text-sm text-neutral-600">Loading sales catalog…</p>}
          {catalogError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-red-50 p-4 text-sm text-red-800"><span>{catalogError}</span><button type="button" onClick={() => setCatalogRetry((current) => current + 1)} className="underline">Try again</button></div>}
          {!catalogLoading && !catalogError && (!customerOptions.length || !employeeOptions.length || !productOptions.length) && <p role="status" className="workspace-notice mb-4 text-sm">Add active customers, employees, and products before creating a sale.</p>}
          <form
            onSubmit={submit}
            noValidate
            className="workspace-panel workspace-form-panel"
          >
            <div className="workspace-table-header">
              <h2 className="text-sm font-semibold text-neutral-900">
                Sale details
              </h2>
            </div>

            <div className="workspace-form-section grid gap-4 sm:grid-cols-2">
              <label>
                <span className="workspace-label">Transaction number</span>
                <input
                  type="text"
                  readOnly
                  value={transactionNo}
                  className="workspace-control"
                />
              </label>
              <label>
                <span className="workspace-label">Sales date</span>
                <input
                  type="date"
                  value={salesDate}
                  onChange={(event) => handleSalesDateChange(event.target.value)}
                  className="workspace-control"
                />
              </label>
              <div className="sm:col-span-2">
                <CustomerCombobox
                  customers={customerOptions}
                  selectedCustomerId={customerId}
                  onSelect={(id) => {
                    setCustomerId(id)
                    setFormError("")
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <EmployeeCombobox
                  employees={employeeOptions}
                  selectedEmployeeId={employeeId}
                  onSelect={(id) => {
                    setEmployeeId(id)
                    setFormError("")
                  }}
                />
              </div>
            </div>

            <section
              aria-labelledby="sale-line-items-heading"
              className="workspace-form-section border-t border-neutral-200"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3
                    id="sale-line-items-heading"
                    className="text-sm font-semibold text-neutral-900"
                  >
                    Line items
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Unit prices are automatically looked up from price history as of {salesDate}.
                  </p>
                </div>
                <span className="workspace-badge workspace-badge--neutral">
                  {lines.length} {lines.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="mb-4">
                <ProductCombobox
                  label="Search and add product"
                  helperBadge="Quick add"
                  placeholder="Search by product code, description, or unit to add…"
                  products={productOptions}
                  selectedProductCode=""
                  salesDate={salesDate}
                  inListCodes={usedProductCodes}
                  clearOnSelect
                  listboxClassName="z-30"
                  onSelect={handleQuickAddProduct}
                />
                {lineFeedback && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-2 text-xs font-medium text-emerald-700"
                  >
                    {lineFeedback}
                  </p>
                )}
              </div>

              <div className="workspace-panel workspace-form-panel">
                <table role="table" className="workspace-table">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100">
                      <th scope="col" className="first:rounded-tl-[11px] last:rounded-tr-[11px]">Product</th>
                      <th scope="col" className="first:rounded-tl-[11px] last:rounded-tr-[11px]">Quantity</th>
                      <th scope="col" className="text-right first:rounded-tl-[11px] last:rounded-tr-[11px]">
                        Unit price
                      </th>
                      <th scope="col" className="text-right first:rounded-tl-[11px] last:rounded-tr-[11px]">
                        Line subtotal
                      </th>
                      <th scope="col" className="workspace-table-actions first:rounded-tl-[11px] last:rounded-tr-[11px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const numericQty = Number(line.quantity)
                      const validQty =
                        Number.isFinite(numericQty) && numericQty > 0
                          ? numericQty
                          : 0
                      const lineSubtotal = getLineSubtotal(
                        validQty,
                        line.unitPrice,
                      )
                      const otherUsedCodes = new Set(
                        lines
                          .filter(
                            (other) => other.id !== line.id && other.productCode,
                          )
                          .map((other) => other.productCode),
                      )

                      return (
                        <tr key={line.id}>
                          <td data-label="Product">
                            <select
                              ref={(el) => {
                                productSelectRefs.current[line.id] = el
                              }}
                              aria-label={`Product ${index + 1}`}
                              value={line.productCode}
                              onChange={(event) =>
                                handleProductChange(line.id, event.target.value)
                              }
                              className="workspace-control"
                            >
                              <option value="">{line.productCode ? "Remove product" : "Select product"}</option>
                              {productOptions.map((product) => (
                                <option
                                  key={product.code}
                                  value={product.code}
                                  disabled={otherUsedCodes.has(product.code)}
                                >
                                  {product.code} — {product.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td data-label="Quantity" className="w-36">
                            <input
                              type="number"
                              aria-label={`Quantity ${index + 1}`}
                              min="1"
                              step="1"
                              value={line.quantity}
                              onChange={(event) =>
                                handleQuantityChange(
                                  line.id,
                                  event.target.value,
                                )
                              }
                              className="workspace-control"
                            />
                          </td>
                          <td data-label="Unit price" className="whitespace-nowrap text-right text-sm tabular-nums text-slate-700">
                            {currency.format(line.unitPrice)}
                          </td>
                          <td data-label="Line subtotal" className="whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-950">
                            {currency.format(lineSubtotal)}
                          </td>
                          <td data-label="Actions" className="workspace-table-actions bg-white">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => removeLineItem(line.id)}
                              aria-label={`Remove line item ${index + 1}`}
                              title="Remove item"
                              className="workspace-icon-action workspace-icon-action--danger"
                            >
                              <DashboardIcon name="close" className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {lines.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-slate-500">
                    No items added yet. Search for a product above or click Add item below.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[11px] border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                  <button
                    type="button"
                    onClick={addLineItem}
                    disabled={catalogLoading || !productOptions.length}
                    className="workspace-secondary-action"
                  >
                    <DashboardIcon name="plus" className="h-4 w-4" />
                    {lines.length === 0 ? "Add item" : "Add another item"}
                  </button>
                  <span className="text-xs text-slate-500">
                    Use Quick add above to search, or choose a product from the dropdown.
                  </span>
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="mt-4 text-xs font-medium text-red-600"
                >
                  {formError}
                </p>
              )}

              <div className="workspace-summary mt-6 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-4 text-right">
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    Subtotal
                  </p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                    {currency.format(subtotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Tax</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                    {currency.format(tax)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Total</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">
                    {currency.format(totalAmount)}
                  </p>
                </div>
              </div>
            </section>

            <div className="workspace-drawer-footer rounded-b-xl">
              <Link
                to="/sales?view=transactions&page=1"
                className="workspace-secondary-action"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={catalogLoading || Boolean(catalogError) || !customerId || !employeeId || !productOptions.length || submitting}
                className="workspace-primary-action"
              >
                {submitting ? "Saving..." : "Save sale"}
              </button>
            </div>
          </form>

          <ConfirmSaleModal
            open={confirmOpen}
            transactionNo={transactionNo}
            salesDate={salesDate}
            customerName={selectedCustomer?.company ?? ""}
            customerCode={selectedCustomer?.id ?? customerId}
            paymentTerm={selectedCustomer?.paymentTerm}
            employeeName={selectedEmployee?.fullName ?? ""}
            employeeCode={selectedEmployee?.id ?? employeeId}
            lines={confirmLines}
            subtotal={subtotal}
            tax={tax}
            totalAmount={totalAmount}
            submitting={submitting}
            error={formError}
            onClose={() => {
              if (!submitting) setConfirmOpen(false)
            }}
            onConfirm={() => {
              void confirmCreateSale()
            }}
          />
        </div>
      </main>
    </DashboardLayout>
  )
}
