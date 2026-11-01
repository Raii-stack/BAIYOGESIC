import { useEffect, useState, type FormEvent } from "react"

import type { JobHistoryEntry } from "../../types/employee"
import { DashboardIcon } from "../dashboard/DashboardComponents"

type AddJobHistoryModalProps = {
  open: boolean
  onClose: () => void
  onSave: (entry: JobHistoryEntry) => void
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
    <div className="workspace-modal-overlay z-[60]">
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
        className="workspace-modal workspace-panel relative w-full max-w-xl shadow-xl"
      >
        <header className="workspace-drawer-header">
          <div>
            <p className="text-xs font-medium text-neutral-500">
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
            className="workspace-icon-action"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="workspace-drawer-body grid gap-4 sm:grid-cols-2">
            <FormField label="Effective Date">
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="workspace-control"
              />
            </FormField>
            <FormField label="Salary">
              <span className="relative block">
                <DashboardIcon
                  name="currency"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="number"
                  required
                  min="0"
                  value={salary}
                  onChange={(event) => setSalary(event.target.value)}
                  placeholder="0"
                  className="workspace-control workspace-control--currency"
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
                  className="workspace-control"
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
                  className="workspace-control"
                />
              </FormField>
            </div>
          </div>

          <footer className="workspace-drawer-footer">
            <button
              type="button"
              onClick={onClose}
              className="workspace-secondary-action"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-primary-action"
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
      <span className="workspace-label">
        {label}
      </span>
      {children}
    </label>
  )
}
