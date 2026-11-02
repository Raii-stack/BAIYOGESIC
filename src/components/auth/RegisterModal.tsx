import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

import { authApi } from "../../lib/auth"
import { safeErrorMessage } from "../../lib/api-errors"
import { notifyToast } from "../../lib/toast"
import type { Errors } from "../../types/auth"
import { emailOk } from "../../utils/validation"
import { Field, Logo, Submit } from "./AuthComponents"
import PasswordStrengthMeter from "./PasswordStrengthMeter"

interface RegisterModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function RegisterModal({ open, onClose, onSuccess }: RegisterModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((curr) => ({ ...curr, [key]: value }))
    if (errors[key]) {
      setErrors((curr) => ({ ...curr, [key]: undefined }))
    }
    if (serverError) setServerError("")
  }

  useEffect(() => {
    if (open) {
      setIsSuccess(false)
      setServerError("")
      setErrors({})
      const timer = window.setTimeout(() => {
        document.getElementById("register-first-name")?.focus()
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
    const nextErrors: Errors = {}
    if (!form.firstName.trim()) nextErrors.firstName = "First name is required."
    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required."
    if (!emailOk(form.email)) nextErrors.email = "Enter a valid work email address."
    if (form.password.length < 8) nextErrors.password = "Use at least 8 characters."
    if (!form.confirmPassword || form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match."
    }

    setErrors(nextErrors)
    setServerError("")
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      await authApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      setIsSuccess(true)
      notifyToast("Account registered successfully.")
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
        aria-labelledby="register-modal-title"
        aria-describedby="register-modal-description"
        onKeyDown={handleKeyDown}
        className="workspace-modal workspace-panel w-full max-w-[480px] p-6 sm:p-8 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close registration dialog"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            ✕
          </button>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            User Self-Registration
          </p>
          <h2 id="register-modal-title" className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Create your account
          </h2>
          <p id="register-modal-description" className="mt-1.5 text-xs text-neutral-500">
            Join HOPE, Inc. ERP workspace. New self-registered accounts are created with standard User (Employee) access.
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
                <p className="font-semibold">Registration complete!</p>
                <p className="mt-1 text-xs text-emerald-800">
                  Your account has been created. You can now sign in with your credentials.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="workspace-primary-action w-full"
            >
              Proceed to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-3.5">
            {serverError && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                {serverError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="register-first-name"
                label="First name"
                autoComplete="given-name"
                placeholder="First name"
                icon="user"
                className="mb-0"
                value={form.firstName}
                onChange={set("firstName")}
                error={errors.firstName}
              />
              <Field
                id="register-last-name"
                label="Last name"
                autoComplete="family-name"
                placeholder="Last name"
                icon="user"
                className="mb-0"
                value={form.lastName}
                onChange={set("lastName")}
                error={errors.lastName}
              />
            </div>

            <Field
              id="register-email"
              label="Work email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              icon="mail"
              className="mb-0"
              value={form.email}
              onChange={set("email")}
              error={errors.email}
            />

            <Field
              id="register-password"
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              icon="lock"
              passwordToggle
              className="mb-0"
              value={form.password}
              onChange={set("password")}
              error={errors.password}
            />
            {form.password && <PasswordStrengthMeter password={form.password} />}

            <Field
              id="register-confirm-password"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              icon="lock"
              passwordToggle
              className="mb-0"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              error={errors.confirmPassword}
            />

            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
              Role: <span className="font-semibold text-neutral-800">User (Employee)</span>. Administrator roles must be granted by existing system administrators.
            </div>

            <div className="pt-2">
              <Submit loading={submitting} loadingLabel="Creating account…">
                Register account
              </Submit>
            </div>

            <p className="pt-2 text-center text-xs text-neutral-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onClose}
                className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
