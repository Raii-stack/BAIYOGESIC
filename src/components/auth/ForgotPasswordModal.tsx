import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

import { authApi } from "../../lib/auth"
import { safeErrorMessage } from "../../lib/api-errors"
import { notifyToast } from "../../lib/toast"
import { emailOk } from "../../utils/validation"
import { Field, Logo, Submit } from "./AuthComponents"

interface ForgotPasswordModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ForgotPasswordModal({ open, onClose, onSuccess }: ForgotPasswordModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [serverError, setServerError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail("")
      setError("")
      setServerError("")
      setIsSuccess(false)
      setResetToken(null)
      const timer = window.setTimeout(() => {
        document.getElementById("forgot-email")?.focus()
      }, 50)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== "Tab") return

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href]',
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!emailOk(email)) {
      setError("Enter a valid work email address.")
      return
    }

    setError("")
    setServerError("")
    setSubmitting(true)

    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase())
      setIsSuccess(true)
      if (res?.token) {
        setResetToken(res.token)
      }
      notifyToast("Password reset request sent.")
      onSuccess?.()
    } catch (err) {
      setServerError(safeErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="workspace-modal-overlay z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        aria-describedby="forgot-password-description"
        onKeyDown={handleKeyDown}
        className="workspace-modal workspace-panel w-full max-w-[440px] p-6 sm:p-8"
      >
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recovery dialog"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            ✕
          </button>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Account Recovery
          </p>
          <h2 id="forgot-password-title" className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Reset password
          </h2>
          <p id="forgot-password-description" className="mt-1.5 text-xs text-neutral-500">
            Enter your work email address and we’ll generate a secure time-limited password reset link.
          </p>
        </div>

        {isSuccess ? (
          <div className="mt-6 space-y-4">
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold">Reset instructions sent!</p>
                <p className="mt-1 text-xs text-emerald-800">
                  If an active account exists for that email, password reset instructions and a secure token have been generated.
                </p>
              </div>
            </div>

            {resetToken && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
                <p className="font-semibold text-neutral-700">Dev/Demo Reset Link:</p>
                <a
                  href={`/reset-password?token=${resetToken}`}
                  className="mt-1 block truncate text-blue-700 underline hover:text-blue-900"
                >
                  /reset-password?token={resetToken}
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="workspace-primary-action w-full"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {serverError && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                {serverError}
              </p>
            )}

            <Field
              id="forgot-email"
              label="Work email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              icon="mail"
              className="mb-0"
              value={email}
              onChange={(val) => {
                setEmail(val)
                if (error) setError("")
                if (serverError) setServerError("")
              }}
              error={error}
            />

            <Submit loading={submitting} loadingLabel="Sending reset link…">
              Send reset link
            </Submit>

            <p className="text-center text-xs text-neutral-500">
              Remembered your password?{" "}
              <button
                type="button"
                onClick={onClose}
                className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
