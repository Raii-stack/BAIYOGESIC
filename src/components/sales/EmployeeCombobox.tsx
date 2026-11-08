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
  const [query, setQuery] = useState("")
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
          aria-controls="employee-options"
          aria-autocomplete="list"
          value={selectedEmployee?.fullName ?? query}
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
            className="workspace-picker absolute inset-x-0 top-[calc(100%+6px)] z-20"
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
                className="workspace-option"
              >
                <span className="min-w-0">
                  <span className="workspace-option-label block">
                    {employee.fullName}
                  </span>
                  <span className="workspace-option-meta mt-0.5 block">
                    {employee.jobTitle}
                  </span>
                </span>
                <span className="workspace-option-meta shrink-0 font-mono">
                  {employee.id}
                </span>
              </button>
            ))}
            {matches.length === 0 && <span className="workspace-picker-empty">No employees found.</span>}
          </span>
        )}
      </span>
    </label>
  )
}
