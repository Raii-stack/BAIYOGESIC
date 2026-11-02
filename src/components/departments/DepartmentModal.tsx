import { useEffect, useRef, useState, type FormEvent } from "react"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import useModalFocus from "../../hooks/useModalFocus"
import type { Department } from "../../lib/department-api"

type DepartmentModalProps = {
  open: boolean
  department?: Department | null
  existingCodes?: string[]
  onClose: () => void
  onSave: (input: { deptcode: string; deptname: string }) => Promise<void>
}

export default function DepartmentModal({
  open,
  department,
  existingCodes = [],
  onClose,
  onSave,
}: DepartmentModalProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})
  const [serverError, setServerError] = useState("")
  const [saving, setSaving] = useState(false)

  const dialogRef = useRef<HTMLElement>(null)
  const initialFocusRef = useRef<HTMLInputElement>(null)

  useModalFocus(open, dialogRef, initialFocusRef, onClose, saving)

  useEffect(() => {
    if (open) {
      setCode(department ? department.code : "")
      setName(department ? department.name : "")
      setErrors({})
      setServerError("")
      setSaving(false)
    }
  }, [open, department])

  if (!open) return null

  const validate = (): boolean => {
    const nextErrors: { code?: string; name?: string } = {}
    const trimmedCode = code.trim().toUpperCase()
    const trimmedName = name.trim()

    if (!department) {
      if (!trimmedCode) {
        nextErrors.code = "Department code is required."
      } else if (trimmedCode.length > 3) {
        nextErrors.code = "Department code must be at most 3 characters."
      } else if (
        existingCodes.some((c) => c.toUpperCase() === trimmedCode)
      ) {
        nextErrors.code = "A department with this code already exists."
      }
    }

    if (!trimmedName) {
      nextErrors.name = "Department name is required."
    } else if (trimmedName.length > 30) {
      nextErrors.name = "Department name must be at most 30 characters."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    setServerError("")
    try {
      await onSave({
        deptcode: (department ? department.code : code).trim().toUpperCase(),
        deptname: name.trim(),
      })
      onClose()
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save department.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (!saving) onClose()
        }}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-modal-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2
              id="department-modal-title"
              className="text-lg font-bold text-neutral-900"
            >
              {department ? "Edit Department" : "Add Department"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {department
                ? "Update department title and corporate naming."
                : "Create a new corporate organizational department."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        {serverError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="department-code"
              className="block text-xs font-semibold text-slate-700"
            >
              Department Code <span className="text-red-500">*</span>
            </label>
            <input
              ref={initialFocusRef}
              id="department-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }))
              }}
              disabled={Boolean(department) || saving}
              maxLength={3}
              placeholder="e.g. FIN"
              aria-required="true"
              aria-invalid={Boolean(errors.code)}
              aria-describedby={errors.code ? "department-code-error" : undefined}
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase outline-none transition focus:ring-2 ${
                errors.code
                  ? "border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-300 bg-white text-neutral-900 focus:border-blue-600 focus:ring-blue-100"
              } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
            />
            {errors.code && (
              <p
                id="department-code-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {errors.code}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="department-name"
              className="block text-xs font-semibold text-slate-700"
            >
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              id="department-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
              }}
              disabled={saving}
              maxLength={30}
              placeholder="e.g. Finance & Accounting"
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "department-name-error" : undefined}
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                errors.name
                  ? "border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-300 bg-white text-neutral-900 focus:border-blue-600 focus:ring-blue-100"
              } disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
            {errors.name && (
              <p
                id="department-name-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {errors.name}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  <span>Saving…</span>
                </>
              ) : department ? (
                "Save changes"
              ) : (
                "Create department"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
