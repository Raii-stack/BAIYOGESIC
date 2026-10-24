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
            event.stopPropagation()
            event.currentTarget.querySelector("input")?.focus()
            setOpen(false)
          }
        }}>
        <DashboardIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400"
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
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
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
                  className={`flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left transition ${
                    customer.id === selectedCustomerId
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {customer.company}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {customer.id}
                  </span>
                </button>
              ))
            ) : (
              <span className="block px-3 py-4 text-sm text-slate-500">
                No customers found.
              </span>
            )}
          </span>
        )}
      </span>
    </label>
  )
}
