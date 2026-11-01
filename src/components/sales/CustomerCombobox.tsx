import { useMemo, useState } from "react"

import { DashboardIcon } from "../dashboard/DashboardComponents"
import type { Customer } from "../../types/customer"

export default function CustomerCombobox({
  customers,
  selectedCustomerId,
  onSelect,
}: {
  customers: Customer[]
  selectedCustomerId: string
  onSelect: (customerId: string) => void
}) {
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  )
  const [query, setQuery] = useState(selectedCustomer?.company ?? "")
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return customers

    return customers.filter(
      (customer) =>
        customer.company.toLowerCase().includes(normalizedQuery) ||
        customer.id.toLowerCase().includes(normalizedQuery),
    )
  }, [customers, query])

  return (
    <label className="block">
      <span className="workspace-label workspace-label--row">
        Customer
        <span className="font-medium text-slate-400">Required</span>
      </span>
      <span className="relative block"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.querySelector("input")?.focus()
            setOpen(false)
          }
        }}>
        <DashboardIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="customer-options"
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
            }
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            onSelect("")
            setOpen(true)
          }}
          placeholder="Search by customer name or ID"
          className="workspace-control workspace-control--search"
        />

        {open && (
          <span
            id="customer-options"
            role="listbox"
            className="workspace-picker absolute inset-x-0 top-[calc(100%+6px)] z-20"
          >
            {matches.length ? (
              matches.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={customer.id === selectedCustomerId}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(customer.id)
                    setQuery(customer.company)
                    setOpen(false)
                  }}
                  className="workspace-option"
                >
                  <span className="workspace-option-label">
                    {customer.company}
                  </span>
                  <span className="workspace-option-meta shrink-0 font-mono">
                    {customer.id}
                  </span>
                </button>
              ))
            ) : (
              <span className="workspace-picker-empty">
                No customers found.
              </span>
            )}
          </span>
        )}
      </span>
    </label>
  )
}
