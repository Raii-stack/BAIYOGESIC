import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { Employee } from "../../types/employee"

type EmployeePanelProps = {
  employee: Employee | null
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

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

export default function EmployeePanel({
  employee,
  open,
  onClose,
}: EmployeePanelProps) {
  const [fullName, setFullName] = useState("")
  const [department, setDepartment] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [hireDate, setHireDate] = useState("")
  const [separationDate, setSeparationDate] = useState("")
  const [salary, setSalary] = useState("")

  useEffect(() => {
    if (!open) return

    setFullName(employee?.fullName ?? "")
    setDepartment(employee?.department ?? "")
    setJobTitle(employee?.jobTitle ?? "")
    setBirthDate(employee?.birthDate ?? "")
    setHireDate(employee?.hireDate ?? "")
    setSeparationDate(employee?.separationDate ?? "")
    setSalary(employee ? String(employee.salary) : "")

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [employee, onClose, open])

  const submit = (event: FormEvent) => {
    event.preventDefault()
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
        aria-label="Close employee form"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-panel-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-300 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.14)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-300 px-6 py-6 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Human Resources / Employee record
            </p>
            <h2
              id="employee-panel-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {employee ? "Edit Employee" : "Add Employee"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Maintain employment details and lifecycle dates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close employee form"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
            <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <FieldLabel>Employee ID</FieldLabel>
                <input
                  type="text"
                  readOnly
                  value={employee?.id ?? "Auto-generated on save"}
                  className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-500 outline-none"
                />
              </label>

              <label className="block sm:col-span-2">
                <FieldLabel>Full Name</FieldLabel>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter employee full name"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <FieldLabel>Department</FieldLabel>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Enter department"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <FieldLabel>Job Title</FieldLabel>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Enter job title"
                  className={fieldClass}
                />
              </label>

              <DateField
                label="Birth Date"
                value={birthDate}
                onChange={setBirthDate}
                required
              />
              <DateField
                label="Hire Date"
                value={hireDate}
                onChange={setHireDate}
                required
              />

              <label className="block sm:col-span-2">
                <FieldLabel>Separation Date</FieldLabel>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                    <CalendarIcon />
                  </span>
                  <input
                    type="date"
                    value={separationDate}
                    min={hireDate || undefined}
                    onChange={(event) => setSeparationDate(event.target.value)}
                    className={`${fieldClass} pl-11`}
                  />
                </span>
                <p className="mt-2 text-xs italic leading-5 text-slate-500">
                  Use this for resigning employees. Do not use the Delete button
                  unless the record was created by mistake.
                </p>
              </label>

              <label className="block sm:col-span-2">
                <FieldLabel>Salary</FieldLabel>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={salary}
                    onChange={(event) => setSalary(event.target.value)}
                    placeholder="0"
                    className={`${fieldClass} pl-7`}
                  />
                </span>
              </label>
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
              Save Employee
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
          <CalendarIcon />
        </span>
        <input
          type="date"
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClass} pl-11`}
        />
      </span>
    </label>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block text-xs font-bold text-slate-700">
      {children}
    </span>
  )
}

const fieldClass =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
