import { useEffect, useState, type FormEvent } from "react"
import { Link, Navigate } from "react-router"
import { useAuth } from "../auth/AuthProvider"

import { authApi } from "../../lib/auth"
import { safeErrorMessage } from "../../lib/api-errors"
import { notifyToast } from "../../lib/toast"
import type { Errors } from "../../types/auth"
import { emailOk } from "../../utils/validation"
import { AuthShell, Field, Submit } from "../auth/AuthComponents"
import PasswordStrengthMeter from "../auth/PasswordStrengthMeter"

export default function RegisterPage() {
  const { user, loading } = useAuth()
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
    document.title = "Register | HOPE, Inc."
  }, [])

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
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }))
      notifyToast("Registration submitted. Your account is pending approval.")
    } catch (err) {
      setServerError(safeErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div role="status" className="grid min-h-screen place-items-center">Checking your session…</div>
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <AuthShell page="create" title="Create your account" subtitle="New accounts start pending. HR, an admin, or a superadmin must approve your account before you can sign in.">

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
                <p className="font-semibold">Registration submitted</p>
                <p className="mt-1 text-xs text-emerald-800">
                  Your account is pending approval. You can sign in once HR, an admin, or a superadmin accepts it.
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="workspace-primary-action w-full"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
            {serverError && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                {serverError}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
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

            <div>
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
              {form.password && <PasswordStrengthMeter password={form.password} className="mt-3" />}
            </div>

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

            <div>
              <Submit loading={submitting} loadingLabel="Creating account…">
                Register account
              </Submit>
            </div>

            <p className="text-center text-xs text-neutral-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}
    </AuthShell>
  )
}
