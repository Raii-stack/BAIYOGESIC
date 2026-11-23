import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type Ref,
} from "react"

import { lookupPriceAsOfDate } from "../../lib/sales"
import type { SaleCatalogProduct } from "../../types/sale"
import { DashboardIcon } from "../dashboard/DashboardComponents"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

type ProductComboboxProps = {
  products: SaleCatalogProduct[]
  selectedProductCode: string
  salesDate: string
  onSelect: (productCode: string) => void
  ariaLabel?: string
  label?: string
  helperBadge?: string
  placeholder?: string
  disabledCodes?: ReadonlySet<string>
  inListCodes?: ReadonlySet<string>
  clearOnSelect?: boolean
  listboxClassName?: string
  inputRef?: Ref<HTMLInputElement>
}

export default function ProductCombobox({
  products,
  selectedProductCode,
  salesDate,
  onSelect,
  ariaLabel,
  label,
  helperBadge,
  placeholder = "Search product code or name",
  disabledCodes,
  inListCodes,
  clearOnSelect = false,
  listboxClassName = "z-20",
  inputRef,
}: ProductComboboxProps) {
  const listboxId = useId()
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const inputElRef = useRef<HTMLInputElement | null>(null)
  const focusFirstOnOpenRef = useRef(false)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const selectedProduct = products.find(
    (product) => product.code === selectedProductCode,
  )
  const selectedLabel = selectedProduct
    ? `${selectedProduct.code} — ${selectedProduct.description}`
    : ""
  const inputValue = clearOnSelect
    ? query
    : selectedProduct
      ? selectedLabel
      : query

  const setMergedInputRef = (node: HTMLInputElement | null) => {
    inputElRef.current = node
    if (typeof inputRef === "function") {
      inputRef(node)
    } else if (inputRef && typeof inputRef === "object") {
      ;(inputRef as MutableRefObject<HTMLInputElement | null>).current = node
    }
  }

  const matches = useMemo(() => {
    const rawQuery =
      !clearOnSelect && selectedProduct ? "" : query.trim().toLowerCase()
    if (!rawQuery) return products
    const tokens = rawQuery.split(/\s+/).filter(Boolean)
    return products.filter((product) => {
      const haystack =
        `${product.code} ${product.description} ${product.unit}`.toLowerCase()
      return tokens.every((token) => haystack.includes(token))
    })
  }, [clearOnSelect, products, query, selectedProduct])

  const getEnabledOptions = () =>
    Array.from(
      wrapperRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) ?? [],
    )

  useEffect(() => {
    if (!open || !focusFirstOnOpenRef.current) return
    focusFirstOnOpenRef.current = false
    getEnabledOptions()[0]?.focus()
  }, [open, matches])

  const selectProduct = (product: SaleCatalogProduct) => {
    if (disabledCodes?.has(product.code)) return
    onSelect(product.code)
    setQuery(clearOnSelect ? "" : `${product.code} — ${product.description}`)
    setOpen(false)
  }

  const comboboxControl = (
    <span
      ref={wrapperRef}
      className="relative block"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          inputElRef.current?.focus()
          setOpen(false)
        }
      }}
    >
      <DashboardIcon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400"
      />
      <input
        ref={setMergedInputRef}
        type="search"
        role="combobox"
        aria-label={label ? undefined : ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={inputValue}
        onFocus={(event) => {
          setOpen(true)
          if (!clearOnSelect && selectedProduct) event.currentTarget.select()
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            if (open) {
              getEnabledOptions()[0]?.focus()
            } else {
              focusFirstOnOpenRef.current = true
              setOpen(true)
            }
          } else if (event.key === "Enter" && open) {
            event.preventDefault()
            if (query.trim()) {
              const firstEnabled = matches.find(
                (product) => !disabledCodes?.has(product.code),
              )
              if (firstEnabled) selectProduct(firstEnabled)
            }
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          if (!clearOnSelect && selectedProductCode) onSelect("")
          setOpen(true)
        }}
        placeholder={placeholder}
        className="workspace-control workspace-control--search"
      />

      {open && (
        <span
          id={listboxId}
          role="listbox"
          className={`workspace-picker absolute inset-x-0 top-[calc(100%+6px)] ${listboxClassName}`}
        >
          {matches.length ? (
            matches.map((product) => {
              const isDisabled = Boolean(disabledCodes?.has(product.code))
              const isInList = Boolean(inListCodes?.has(product.code))
              const effectivePrice =
                lookupPriceAsOfDate(
                  product.priceHistory,
                  salesDate,
                  product.currentPrice,
                ) ??
                product.currentPrice ??
                0

              return (
                <button
                  key={product.code}
                  type="button"
                  role="option"
                  disabled={isDisabled}
                  aria-disabled={isDisabled || undefined}
                  aria-selected={
                    !clearOnSelect && product.code === selectedProductCode
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectProduct(product)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault()
                      const options = getEnabledOptions()
                      const currentIndex = options.indexOf(event.currentTarget)
                      if (event.key === "ArrowDown") {
                        options[currentIndex + 1]?.focus()
                      } else if (currentIndex <= 0) {
                        inputElRef.current?.focus()
                      } else {
                        options[currentIndex - 1]?.focus()
                      }
                    }
                  }}
                  className={`workspace-option ${
                    isDisabled ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="workspace-option-label block">
                      {product.code} — {product.description}
                    </span>
                    <span className="workspace-option-meta mt-0.5 block tabular-nums">
                      {currency.format(effectivePrice)} / {product.unit}
                    </span>
                  </span>
                  <span className="workspace-option-meta shrink-0 font-mono">
                    {isDisabled ? "Added" : isInList ? "In list · +1" : product.unit}
                  </span>
                </button>
              )
            })
          ) : (
            <span className="workspace-picker-empty">No products found.</span>
          )}
        </span>
      )}
    </span>
  )

  if (!label) return comboboxControl

  return (
    <label className="block">
      <span className="workspace-label workspace-label--row">
        {label}
        {helperBadge && (
          <span className="font-medium text-slate-400">{helperBadge}</span>
        )}
      </span>
      {comboboxControl}
    </label>
  )
}
