import { useEffect, useRef, useState, type FormEvent } from "react"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import useModalFocus from "../../hooks/useModalFocus"

type JobModalProps = {
  open: boolean
  job?: { code: string; description: string } | null
  existingCodes?: string[]
  onClose: () => void
  onSave: (input: { jobcode: string; jobdesc: string }) => Promise<void>
}

export default function JobModal({
  open,
  job,
  existingCodes = [],
  onClose,
  onSave,
}: JobModalProps) {
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [errors, setErrors] = useState<{ code?: string; description?: string }>({})
  const [serverError, setServerError] = useState("")
  const [saving, setSaving] = useState(false)

  const dialogRef = useRef<HTMLElement>(null)
  const initialFocusRef = useRef<HTMLInputElement>(null)

  useModalFocus(open, dialogRef, initialFocusRef, onClose, saving)

  useEffect(() => {
    if (open) {
      setCode(job ? job.code : "")
      setDescription(job ? job.description : "")
      setErrors({})
      setServerError("")
      setSaving(false)
    }
  }, [open, job])

  if (!open) return null

  const validate = (): boolean => {
    const nextErrors: { code?: string; description?: string } = {}
    const trimmedCode = code.trim().toUpperCase()
    const trimmedDesc = description.trim()

    if (!job) {
      if (!trimmedCode) {
        nextErrors.code = "Job code is required."
      } else if (trimmedCode.length > 4) {
        nextErrors.code = "Job code must be at most 4 characters."
      } else if (
        existingCodes.some((c) => c.toUpperCase() === trimmedCode)
      ) {
        nextErrors.code = "A job position with this code already exists."
      }
    }

    if (!trimmedDesc) {
      nextErrors.description = "Job description is required."
    } else if (trimmedDesc.length > 20) {
      nextErrors.description = "Job description must be at most 20 characters."
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
        jobcode: (job ? job.code : code).trim().toUpperCase(),
        jobdesc: description.trim(),
      })
      onClose()
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save job position.",
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
        aria-labelledby="job-modal-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2
              id="job-modal-title"
              className="text-lg font-bold text-neutral-900"
            >
              {job ? "Edit Job Position" : "Add Job Position"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {job
                ? "Update job title and designation details."
                : "Create a new corporate job position or title."}
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
              htmlFor="job-code"
              className="block text-xs font-semibold text-slate-700"
            >
              Job Code <span className="text-red-500">*</span>
            </label>
            <input
              ref={initialFocusRef}
              id="job-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }))
              }}
              disabled={Boolean(job) || saving}
              maxLength={4}
              placeholder="e.g. MGR"
              aria-required="true"
              aria-invalid={Boolean(errors.code)}
              aria-describedby={errors.code ? "job-code-error" : undefined}
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase outline-none transition focus:ring-2 ${
                errors.code
                  ? "border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-300 bg-white text-neutral-900 focus:border-blue-600 focus:ring-blue-100"
              } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
            />
            {errors.code && (
              <p
                id="job-code-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {errors.code}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="job-desc"
              className="block text-xs font-semibold text-slate-700"
            >
              Job Title / Description <span className="text-red-500">*</span>
            </label>
            <input
              id="job-desc"
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (errors.description)
                  setErrors((prev) => ({ ...prev, description: undefined }))
              }}
              disabled={saving}
              maxLength={20}
              placeholder="e.g. Branch Manager"
              aria-required="true"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "job-desc-error" : undefined}
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                errors.description
                  ? "border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-300 bg-white text-neutral-900 focus:border-blue-600 focus:ring-blue-100"
              } disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
            {errors.description && (
              <p
                id="job-desc-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {errors.description}
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
              ) : job ? (
                "Save changes"
              ) : (
                "Create job"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
