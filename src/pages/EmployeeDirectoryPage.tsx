import { useMemo, useState } from "react"

import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import EmployeePanel from "../components/employees/EmployeePanel"
import EmployeeTable from "../components/employees/EmployeeTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { employees } from "../lib/employees"
import type { Employee } from "../types/employee"

function AddIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export default function EmployeeDirectoryPage() {
  const [query, setQuery] = useState("")
  const [department, setDepartment] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  )

  const openNewEmployee = () => {
    setSelectedEmployee(null)
    setPanelOpen(true)
  }

  const openEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setPanelOpen(true)
  }

  const departments = useMemo(
    () => [...new Set(employees.map((employee) => employee.department))].sort(),
    [],
  )
  const jobTitles = useMemo(
    () => [...new Set(employees.map((employee) => employee.jobTitle))].sort(),
    [],
  )

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return employees.filter((employee) => {
      const matchesName =
        !normalizedQuery ||
        employee.fullName.toLowerCase().includes(normalizedQuery)
      const matchesDepartment =
        !department || employee.department === department
      const matchesTitle = !jobTitle || employee.jobTitle === jobTitle

      return matchesName && matchesDepartment && matchesTitle
    })
  }, [department, jobTitle, query])

  return (
    <DashboardLayout
      activeNavigation="Human Resources"
      searchPlaceholder="Search workspace"
    >
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                  Human Resources / Personnel register
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Employee Directory
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Review employment records and role-controlled compensation
                  information.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewEmployee}
                className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                <AddIcon />
                Add Employee
              </button>
            </div>

            <section
              aria-label="Employee filters"
              className="mb-5 grid gap-3 border border-slate-300 bg-white p-4 md:grid-cols-[minmax(240px,1fr)_minmax(190px,0.55fr)_minmax(220px,0.65fr)]"
            >
              <label>
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Employee Name
                </span>
                <span className="relative block">
                  <DashboardIcon
                    name="search"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search employee name"
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  />
                </span>
              </label>

              <FilterSelect
                label="Department"
                value={department}
                onChange={setDepartment}
                options={departments}
                defaultLabel="All departments"
              />
              <FilterSelect
                label="Job Title"
                value={jobTitle}
                onChange={setJobTitle}
                options={jobTitles}
                defaultLabel="All job titles"
              />
            </section>

            <EmployeeTable
              employees={filteredEmployees}
              onEdit={openEditEmployee}
              showAdminAudit
            />
          </div>
        </main>

        <EmployeePanel
          employee={selectedEmployee}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
      </>
    </DashboardLayout>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  defaultLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  defaultLabel: string
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold text-slate-700">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-slate-50 px-3 pr-9 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
        >
          <option value="">{defaultLabel}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
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
    </label>
  )
}
