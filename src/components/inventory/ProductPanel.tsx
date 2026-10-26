import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ProductInput } from "../../lib/product-api"
import type { Product, UnitType } from "../../types/product"

type ProductPanelProps = {
  product: Product | null
  open: boolean
  onClose: () => void
  onSave: (input: ProductInput) => Promise<void>
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
  onSave,
}: ProductPanelProps) {
  const [description, setDescription] = useState("")
  const [unitType, setUnitType] = useState<UnitType | "">("")
  const [unitPrice, setUnitPrice] = useState("")
  const [errors, setErrors] = useState({
    description: "",
    unitType: "",
    unitPrice: "",
  })
  const [saveError, setSaveError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    setDescription(product?.description ?? "")
    setUnitType(product?.unitType ?? "")
    setUnitPrice(product?.currentPrice === null || !product ? "" : String(product.currentPrice))
    setErrors({ description: "", unitType: "", unitPrice: "" })
    setSaveError("")
  }, [open, product])

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open, saving])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedPrice = unitPrice.trim()
    const price = Number(normalizedPrice)
    const nextErrors = {
      description: !description.trim()
        ? "Product Description is required."
        : description.trim().length > 30 ? "Description must be 30 characters or fewer." : "",
      unitType: unitType ? "" : "Unit Type is required.",
      unitPrice: /^\d+(?:\.\d{1,2})?$/.test(normalizedPrice) && price > 0 && price <= 99999999.99
        ? ""
        : "Enter a price above zero with up to two decimal places.",
    }

    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    setSaving(true)
    setSaveError("")
    try {
      await onSave({ description: description.trim(), unit: unitType as UnitType, unitprice: price })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save product.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        aria-label="Close product form"
        onClick={() => { if (!saving) onClose() }}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-panel-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-neutral-200 bg-white shadow-xl workspace-drawer transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="workspace-drawer-header">
          <div>

            <h2
              id="product-panel-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {product ? "Edit Product" : "Add Product"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Maintain the product identity, unit, and current catalog price.</p>
          </div>
          <button
            type="button"
            onClick={() => { if (!saving) onClose() }}
            aria-label="Close product form"
            className="workspace-icon-action"
          >
            <CloseIcon />
          </button>
        </header>

        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="workspace-drawer-body">
            <div className="workspace-notice">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-900">
                Controlled catalog record
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Product codes are assigned automatically and unit types must be
                selected from the approved list.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="workspace-label">
                  Product Code
                </span>
                <input
                  type="text"
                  readOnly
                  value={product?.code ?? "Auto-generated on save"}
                  className="workspace-control"
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
                  maxLength={30}
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
                    className={`${inputClass(Boolean(errors.unitType))} bg-slate-50 pr-9 ${
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
                    className={`${inputClass(Boolean(errors.unitPrice))} workspace-control--currency`}
                  />
                </span>
              </ValidatedField>
              <p className="text-xs leading-5 text-slate-500">A changed price takes effect today and is recorded in price history.</p>
            </div>
          </div>

          <footer className="workspace-drawer-footer">
            {saveError && <p role="alert" className="mr-auto text-xs font-semibold text-red-700">{saveError}</p>}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="workspace-secondary-action"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="workspace-primary-action"
            >
              {saving ? "Saving…" : product ? "Save changes" : "Create product"}
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
      <span className="workspace-label workspace-label--row">
        {label}
        <span className="font-medium text-slate-400">Required</span>
      </span>
      {children}
      <p
        id={errorId}
        aria-live="polite"
        className={error ? "mt-2 text-xs font-medium leading-4 text-red-600" : "sr-only"}
      >
        {error || "\u00a0"}
      </p>
    </label>
  )
}

function inputClass(error: boolean) {
  return `workspace-control ${
    error
      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
  }`
}
