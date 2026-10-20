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
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
        Employee (Salesperson)
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
          aria-controls="employee-options"
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onChange={(event) => {
            setQuery(event.target.value)
            onSelect("")
            setOpen(true)
          }}
          placeholder="Search salesperson name or ID"
          className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
        />

        {open && (
          <span
            id="employee-options"
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto border border-slate-300 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
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
                    ? "bg-blue-50 text-blue-900"
                    : "text-slate-700 hover:bg-slate-50"
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
          </span>
        )}
      </span>
    </label>
  )
}
