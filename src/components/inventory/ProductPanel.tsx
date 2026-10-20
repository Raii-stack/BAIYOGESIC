import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { Product, UnitType } from "../../types/product"

type ProductPanelProps = {
  product: Product | null
  open: boolean
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export default function ProductPanel({
  product,
  open,
  onClose,
}: ProductPanelProps) {
  const [description, setDescription] = useState("")
  const [unitType, setUnitType] = useState<UnitType | "">("")
  const [unitPrice, setUnitPrice] = useState("")
  const [errors, setErrors] = useState({
    description: "",
    unitType: "",
    unitPrice: "",
  })

  useEffect(() => {
    if (!open) return

    setDescription(product?.description ?? "")
    setUnitType(product?.unitType ?? "")
    setUnitPrice(product ? String(product.currentPrice) : "")
    setErrors({ description: "", unitType: "", unitPrice: "" })

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open, product])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = {
      description: description.trim() ? "" : "Product Description is required.",
      unitType: unitType ? "" : "Unit Type is required.",
      unitPrice:
        Number(unitPrice) > 0
          ? ""
          : "Current Unit Price must be greater than zero.",
    }

    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    onClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close product form"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-panel-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.14)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-300 px-6 py-6 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Inventory / Product record
            </p>
            <h2
              id="product-panel-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {product ? "Edit Product" : "Add Product"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Maintain the product identity, unit, and current catalog price.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product form"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
            <div className="border-l-2 border-blue-800 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-900">
                Controlled catalog record
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Product codes are assigned automatically and unit types must be
                selected from the approved list.
              </p>
            </div>

            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Product Code
                </span>
                <input
                  type="text"
                  readOnly
                  value={product?.code ?? "Auto-generated on save"}
                  className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-500 outline-none"
                />
              </label>

              <ValidatedField
                label="Product Description"
                error={errors.description}
                errorId="product-description-error"
              >
                <input
                  type="text"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    if (errors.description) {
                      setErrors((current) => ({
                        ...current,
                        description: "",
                      }))
                    }
                  }}
                  placeholder="Enter product description"
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby="product-description-error"
                  className={inputClass(Boolean(errors.description))}
                />
              </ValidatedField>

              <ValidatedField
                label="Unit Type"
                error={errors.unitType}
                errorId="product-unit-error"
              >
                <span className="relative block">
                  <select
                    value={unitType}
                    onChange={(event) => {
                      setUnitType(event.target.value as UnitType | "")
                      if (errors.unitType) {
                        setErrors((current) => ({
                          ...current,
                          unitType: "",
                        }))
                      }
                    }}
                    aria-invalid={Boolean(errors.unitType)}
                    aria-describedby="product-unit-error"
                    className={`${inputClass(Boolean(errors.unitType))} appearance-none bg-slate-50 pr-9 ${
                      unitType ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    <option value="">Select approved unit type</option>
                    <option value="pc">pc</option>
                    <option value="ea">ea</option>
                    <option value="mtr">mtr</option>
                    <option value="pkg">pkg</option>
                    <option value="ltr">ltr</option>
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="m6 8 4 4 4-4" />
                  </svg>
                </span>
              </ValidatedField>

              <ValidatedField
                label="Current Unit Price"
                error={errors.unitPrice}
                errorId="product-price-error"
              >
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={unitPrice}
                    onChange={(event) => {
                      setUnitPrice(event.target.value)
                      if (errors.unitPrice) {
                        setErrors((current) => ({
                          ...current,
                          unitPrice: "",
                        }))
                      }
                    }}
                    placeholder="0.00"
                    aria-invalid={Boolean(errors.unitPrice)}
                    aria-describedby="product-price-error"
                    className={`${inputClass(Boolean(errors.unitPrice))} pl-7`}
                  />
                </span>
              </ValidatedField>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-300 bg-white px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              Save Product
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}

function ValidatedField({
  label,
  error,
  errorId,
  children,
}: {
  label: string
  error: string
  errorId: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
        {label}
        <span className="font-medium text-slate-400">Required</span>
      </span>
      {children}
      <p
        id={errorId}
        aria-live="polite"
        className={`min-h-6 pt-1.5 text-xs font-semibold ${
          error ? "text-red-600" : "opacity-0"
        }`}
      >
        {error || "\u00a0"}
      </p>
    </label>
  )
}

function inputClass(error: boolean) {
  return `h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
    error
      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
  }`
}
