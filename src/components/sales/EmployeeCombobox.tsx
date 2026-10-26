import { useMemo, useState } from "react"

import type { Employee } from "../../types/employee"
import { DashboardIcon } from "../dashboard/DashboardComponents"

export default function EmployeeCombobox({
  employees,
  selectedEmployeeId,
  onSelect,
}: {
  employees: Employee[]
  selectedEmployeeId: string
  onSelect: (employeeId: string) => void
}) {
  const selectedEmployee = employees.find(
    (employee) => employee.id === selectedEmployeeId,
  )
  const [query, setQuery] = useState(selectedEmployee?.fullName ?? "")
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return employees

    return employees.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(normalizedQuery) ||
        employee.id.toLowerCase().includes(normalizedQuery) ||
        employee.jobTitle.toLowerCase().includes(normalizedQuery),
    )
  }, [employees, query])

  return (
    <label className="block">
      <span className="workspace-label workspace-label--row">
        Employee (Salesperson)
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
          aria-controls="employee-options"
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
          placeholder="Search salesperson name or ID"
          className="workspace-control workspace-control--search"
        />

        {open && (
          <span
            id="employee-options"
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
          >
            {matches.map((employee) => (
              <button
                key={employee.id}
                type="button"
                role="option"
                aria-selected={employee.id === selectedEmployeeId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(employee.id)
                  setQuery(employee.fullName)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left transition ${
                  employee.id === selectedEmployeeId
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {employee.fullName}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {employee.jobTitle}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {employee.id}
                </span>
              </button>
            ))}
            {matches.length === 0 && <span className="block px-3 py-4 text-sm text-neutral-500">No employees found.</span>}
          </span>
        )}
      </span>
    </label>
  )
}
