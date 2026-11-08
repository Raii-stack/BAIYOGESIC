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
  const [verification, setVerification] = useState<{ expiresAt: string; resendAt: string } | null>(null)
  const [verificationCode, setVerificationCode] = useState("")
  const [now, setNow] = useState(Date.now())
  const resendSeconds = verification ? Math.max(0, Math.ceil((Date.parse(verification.resendAt) - now) / 1000)) : 0
  const codeExpired = Boolean(verification && Date.parse(verification.expiresAt) <= now)

  useEffect(() => {
    if (!verification || isSuccess) return
    document.getElementById("register-code")?.focus()
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [verification, isSuccess])

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

  const sendCode = async () => {
    setSubmitting(true)
    setServerError("")
    try {
      const result = await authApi.sendRegistrationCode(form.email.trim())
      setNow(Date.now())
      setVerification(result)
      setVerificationCode("")
      setErrors({})
    } catch (error) {
      setServerError(safeErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors: Errors = {}
    if (!form.firstName.trim()) nextErrors.firstName = "First name is required."
    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required."
    if (!emailOk(form.email)) nextErrors.email = "Enter a valid work email address."
    if (form.password.length < 8) nextErrors.password = "Use at least 8 characters."
    if (!form.confirmPassword || form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match."
    }
    if (verification && !/^\d{6}$/.test(verificationCode)) nextErrors.verificationCode = "Enter the 6-digit code from your email."

    setErrors(nextErrors)
    setServerError("")
    if (Object.keys(nextErrors).length) return
    if (!verification) return sendCode()
    if (codeExpired) return

    setSubmitting(true)
    try {
      await authApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        verificationCode,
      })
      setIsSuccess(true)
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }))
      setVerificationCode("")
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
    <AuthShell page="create" title={isSuccess ? "Awaiting approval" : verification ? "Verify your email" : "Create your account"} subtitle="Verify your email, then submit your registration. HR, an admin, or a superadmin must approve your account before you can sign in.">

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

            {!verification ? <fieldset disabled={submitting} className="flex min-w-0 flex-col gap-4">
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
            </fieldset> : <>
              <div role="status" className={`rounded-lg border p-4 text-sm ${codeExpired ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
                <p className="font-semibold">{codeExpired ? "Verification code expired" : "Check your inbox"}</p>
                <p className="mt-1 break-words">{codeExpired ? "Request a new code to continue. Your registration has not been submitted." : `We sent a 6-digit code to ${form.email.trim()}. It expires in 10 minutes. Check your spam folder too.`}</p>
              </div>
              {!codeExpired && <fieldset disabled={submitting}>
                <Field id="register-code" label="Verification code" icon="lock" placeholder="6-digit code"
                  autoComplete="one-time-code" inputMode="numeric" maxLength={6} className="mb-0"
                  value={verificationCode} onChange={(value) => { setVerificationCode(value.replace(/\D/g, "")); setErrors({}); setServerError("") }}
                  error={errors.verificationCode} />
              </fieldset>}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <button type="button" className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
                  disabled={submitting || resendSeconds > 0} onClick={sendCode}>
                  {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
                </button>
                <button type="button" className="font-medium text-neutral-600 underline underline-offset-2 disabled:opacity-50"
                  disabled={submitting} onClick={() => { setVerification(null); setVerificationCode(""); setErrors({}); setServerError("") }}>
                  Edit registration details
                </button>
              </div>
            </>}

            {!codeExpired && <div>
              <Submit loading={submitting} loadingLabel={verification ? "Verifying and submitting…" : "Sending code…"}>
                {verification ? "Verify and submit registration" : "Send verification code"}
              </Submit>
            </div>}

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
