import { useEffect, useState, type FormEvent } from "react"

import type { JobHistoryEntry } from "../../types/employee"

type AddJobHistoryModalProps = {
  open: boolean
  onClose: () => void
  onSave: (entry: JobHistoryEntry) => void
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

export default function AddJobHistoryModal({
  open,
  onClose,
  onSave,
}: AddJobHistoryModalProps) {
  const [effectiveDate, setEffectiveDate] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [department, setDepartment] = useState("")
  const [salary, setSalary] = useState("")

  useEffect(() => {
    if (!open) return

    setEffectiveDate("")
    setJobTitle("")
    setDepartment("")
    setSalary("")

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open])

  if (!open) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()

    if (!effectiveDate || !jobTitle.trim() || !department.trim() || !salary) {
      return
    }

    onSave({
      id: `JOB-${Date.now()}`,
      effectiveDate,
      jobTitle: jobTitle.trim(),
      department: department.trim(),
      salary: Number(salary),
      stamp: "CREATED system 2026-10-01 9:00 AM",
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4 py-8">
      <button
        type="button"
        aria-label="Close job history form"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-history-modal-title"
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-slate-300 border-t-[3px] border-t-blue-800 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-300 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Personnel change
            </p>
            <h2
              id="job-history-modal-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              Add Job History
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Record a promotion, transfer, or compensation change.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job history form"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="grid gap-5 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <FormField label="Effective Date">
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
              />
            </FormField>
            <FormField label="Salary">
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                  $
                </span>
                <input
                  type="number"
                  required
                  min="0"
                  value={salary}
                  onChange={(event) => setSalary(event.target.value)}
                  placeholder="0"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                />
              </span>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Job Title">
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Enter the new job title"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Department">
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Enter the department"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                />
              </FormField>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              Save Job History
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}
