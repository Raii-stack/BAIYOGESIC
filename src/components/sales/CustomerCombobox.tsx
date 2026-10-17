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
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
        Customer
        <span className="font-medium text-slate-400">Required</span>
      </span>
      <span className="relative block">
        <DashboardIcon
          name="search"
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="customer-options"
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onChange={(event) => {
            setQuery(event.target.value)
            onSelect("")
            setOpen(true)
          }}
          placeholder="Search by customer name or ID"
          className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
        />

        {open && (
          <span
            id="customer-options"
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto border border-slate-300 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
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
                      ? "bg-blue-50 text-blue-900"
                      : "text-slate-700 hover:bg-slate-50"
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
