import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"

import CustomerCombobox from "../components/sales/CustomerCombobox"
import EmployeeCombobox from "../components/sales/EmployeeCombobox"
import DashboardLayout from "../layouts/DashboardLayout"
import { customers as fallbackCustomers } from "../lib/customers"
import { employees as fallbackEmployees } from "../lib/employees"
import {
  getLineSubtotal,
  lookupPriceAsOfDate,
  roundCurrency,
  saleCatalogProducts,
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
  const [customerOptions, setCustomerOptions] =
    useState<Customer[]>(fallbackCustomers)
  const [employeeOptions, setEmployeeOptions] =
    useState<Employee[]>(fallbackEmployees)
  const [productOptions, setProductOptions] =
    useState<SaleCatalogProduct[]>(saleCatalogProducts)

  const [transactionNo, setTransactionNo] = useState("Auto-numbered on save")
  const [salesDate, setSalesDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA").format(new Date()),
  )
  const [customerId, setCustomerId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [lines, setLines] = useState<DraftLineItem[]>(() => {
    const initialProduct = saleCatalogProducts[0]
    const initialDate = new Intl.DateTimeFormat("en-CA").format(new Date())
    return [
      {
        id: "line-1",
        productCode: initialProduct?.code ?? "",
        quantity: "1",
        unitPrice: initialProduct
          ? resolveProductPrice(saleCatalogProducts, initialProduct.code, initialDate)
          : 0,
      },
    ]
  })
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    salesApi
      .catalog(controller.signal)
      .then((catalog) => {
        if (!catalog) return
        if (catalog.customers.length > 0) setCustomerOptions(catalog.customers)
        if (catalog.employees.length > 0) setEmployeeOptions(catalog.employees)
        if (catalog.products.length > 0) {
          setProductOptions(catalog.products)
          setLines((current) =>
            current.map((line, index) => {
              const targetCode =
                catalog.products.some((p) => p.code === line.productCode)
                  ? line.productCode
                  : index === 0
                    ? catalog.products[0].code
                    : line.productCode
              return {
                ...line,
                productCode: targetCode,
                unitPrice: resolveProductPrice(
                  catalog.products,
                  targetCode,
                  salesDate,
                ),
              }
            }),
          )
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

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
      if (!line.productCode) return
      salesApi
        .lookupPrice(line.productCode, nextDate)
        .then((lookup) => {
          if (!lookup) return
          setLines((current) =>
            current.map((entry) =>
              entry.id === line.id
                ? { ...entry, unitPrice: lookup.unitPrice }
                : entry,
            ),
          )
        })
        .catch(() => {})
    })
  }

  const handleProductChange = (lineId: string, productCode: string) => {
    setFormError("")
    const localPrice = resolveProductPrice(productOptions, productCode, salesDate)
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? { ...line, productCode, unitPrice: localPrice }
          : line,
      ),
    )

    if (productCode) {
      salesApi
        .lookupPrice(productCode, salesDate)
        .then((lookup) => {
          if (!lookup) return
          setLines((current) =>
            current.map((line) =>
              line.id === lineId
                ? { ...line, unitPrice: lookup.unitPrice }
                : line,
            ),
          )
        })
        .catch(() => {})
    }
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
    const usedCodes = new Set(lines.map((line) => line.productCode))
    const nextProduct =
      productOptions.find((product) => !usedCodes.has(product.code)) ||
      productOptions[0]
    const nextCode = nextProduct?.code ?? ""
    setLines((current) => [
      ...current,
      {
        id: `line-${Date.now()}-${current.length + 1}`,
        productCode: nextCode,
        quantity: "1",
        unitPrice: nextCode
          ? resolveProductPrice(productOptions, nextCode, salesDate)
          : 0,
      },
    ])
  }

  const removeLineItem = (lineId: string) => {
    setFormError("")
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.id !== lineId) : current,
    )
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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError("")

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

      if (created) {
        setTransactionNo(created.transactionNo)
        notifyToast(`Sales order ${created.transactionNo} created.`, "success")
        navigate("/sales?view=transactions&page=1")
      } else {
        notifyToast("Sale recorded.", "success")
      }
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

            <div className="grid gap-4 p-6 sm:grid-cols-2">
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
              className="border-t border-neutral-200 p-6"
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
                <button
                  type="button"
                  onClick={addLineItem}
                  className="workspace-secondary-action"
                >
                  Add line item
                </button>
              </div>

              <div className="workspace-panel workspace-table-scroll">
                <table className="workspace-table min-w-[680px]">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100">
                      <th scope="col">Product</th>
                      <th scope="col">Quantity</th>
                      <th scope="col" className="text-right">
                        Unit price
                      </th>
                      <th scope="col" className="text-right">
                        Line subtotal
                      </th>
                      <th scope="col" className="workspace-table-actions">
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

                      return (
                        <tr key={line.id}>
                          <td>
                            <select
                              aria-label={`Product ${index + 1}`}
                              value={line.productCode}
                              onChange={(event) =>
                                handleProductChange(line.id, event.target.value)
                              }
                              className="workspace-control"
                            >
                              <option value="">Select product</option>
                              {productOptions.map((product) => (
                                <option key={product.code} value={product.code}>
                                  {product.code} — {product.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="w-36">
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
                          <td className="whitespace-nowrap text-right text-sm tabular-nums text-slate-700">
                            {currency.format(line.unitPrice)}
                          </td>
                          <td className="whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-950">
                            {currency.format(lineSubtotal)}
                          </td>
                          <td className="workspace-table-actions">
                            <button
                              type="button"
                              disabled={lines.length <= 1}
                              onClick={() => removeLineItem(line.id)}
                              className="workspace-text-action text-red-700 disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="mt-4 text-xs font-medium text-red-600"
                >
                  {formError}
                </p>
              )}

              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-4 text-right">
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
                disabled={!customerId || !employeeId || submitting}
                className="workspace-primary-action"
              >
                {submitting ? "Saving..." : "Save sale"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </DashboardLayout>
  )
}
