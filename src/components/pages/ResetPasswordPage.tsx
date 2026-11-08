import { useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useSearchParams } from "react-router"

import { authApi, AuthApiError } from "../../lib/auth"
import { safeErrorMessage } from "../../lib/api-errors"
import { notifyToast } from "../../lib/toast"
import type { Errors } from "../../types/auth"
import {
  Field,
  Logo,
  Submit,
} from "../auth/AuthComponents"
import PasswordStrengthMeter from "../auth/PasswordStrengthMeter"
import ForgotPasswordModal from "../auth/ForgotPasswordModal"

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const { hash } = useLocation()
  const token = new URLSearchParams(hash.slice(1)).get("token") || searchParams.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [link, setLink] = useState<{ token: string; status: "checking" | "valid" | "expired" | "used" | "invalid" | "error"; expiresAt?: string }>({ token, status: "checking" })
  const [retry, setRetry] = useState(0)
  const [showRecovery, setShowRecovery] = useState(false)
  const status = !token ? "invalid" : link.token === token ? link.status : "checking"

  useEffect(() => {
    const controller = new AbortController()
    setDone(false)
    setPassword("")
    setConfirm("")
    setErrors({})
    setLink({ token, status: "checking" })
    if (token) authApi.validateResetToken(token, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setLink({ token, ...result }) })
      .catch(() => { if (!controller.signal.aborted) setLink({ token, status: "error" }) })
    return () => controller.abort()
  }, [token, retry])

  useEffect(() => {
    if (status !== "valid" || !link.expiresAt || done) return
    const timer = window.setTimeout(() => {
      setLink({ token, status: "expired" })
      setPassword("")
      setConfirm("")
    }, Math.max(0, Date.parse(link.expiresAt) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [status, link.expiresAt, token, done])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || status !== "valid") return
    const nextErrors: Errors = {}
    if (password.length < 8) {
      nextErrors.password = "Use at least 8 characters."
    }
    if (!confirm || confirm !== password) {
      nextErrors.confirm = "Passwords do not match."
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !token) return
    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setPassword("")
      setConfirm("")
      notifyToast("Password updated. You can now sign in.")
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 400) {
        try { setLink({ token, ...await authApi.validateResetToken(token) }) }
        catch { setLink({ token, status: "error" }) }
      }
      notifyToast(safeErrorMessage(error), "error")
    } finally { setSubmitting(false) }
  }

  return (
    <main className="workspace-auth flex min-h-dvh flex-col bg-[#f6f6f7] px-4 py-6 font-sans text-neutral-900 antialiased sm:px-6 sm:py-10">
      <div className="flex flex-1 items-center justify-center">
        <section
          aria-labelledby="reset-password-heading"
          className="workspace-panel w-full max-w-[440px] p-6 sm:p-8"
        >
          <Logo />

          <div className="mt-8" aria-live="polite">
            <p className="text-xs font-medium text-neutral-500">
              Secure password reset
            </p>
            <h1
              id="reset-password-heading"
              className="mt-3 text-2xl font-semibold tracking-[-0.5px] text-neutral-900"
            >
              {done ? "Password updated" : {
                checking: "Checking your reset link…", valid: "Create New Password",
                expired: "Reset link expired", used: "Reset link already used",
                invalid: "Invalid reset link", error: "Unable to check this link",
              }[status]}
            </h1>
            {!done && <p role={status === "checking" ? "status" : undefined} className={`mt-3 text-sm leading-6 ${status === "expired" || status === "used" ? "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" : "text-neutral-500"}`}>
              {{ checking: "Please wait while we check that this link is still active.",
                valid: "Choose a new password. Your reset link expires after 15 minutes and can be used once.",
                expired: "This password-reset link has expired. Request a new link to reset your password.",
                used: "This password-reset link has already been used. Request a new link if you still need to change your password.",
                invalid: "A valid password-reset link is required. Request a new link to continue.",
                error: "We couldn't check your link right now. Please try again.",
              }[status]}
            </p>}
          </div>

          {status === "valid" && !done && <form onSubmit={submit} noValidate className="mt-7">
            <Field
              id="reset-password"
              label="New Password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter a secure password"
              icon="lock"
              passwordToggle
              value={password}
              onChange={setPassword}
              error={errors.password}
            />
            <PasswordStrengthMeter password={password} />
            <Field
              id="reset-confirm-password"
              label="Confirm New Password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your new password"
              icon="lock"
              passwordToggle
              value={confirm}
              onChange={setConfirm}
              error={errors.confirm}
            />
            <div className="mt-1">
              <Submit
                loading={submitting}
                loadingLabel="Updating password…"
              >
                Update Password
              </Submit>
            </div>
          </form>}
          {done && <p role="status" className="mt-7 text-sm font-semibold text-emerald-800">Password updated. You can now sign in.</p>}
          {!done && ["expired", "used", "invalid"].includes(status) && <button type="button" className="workspace-primary-action mt-6 w-full" onClick={() => setShowRecovery(true)}>Request a new reset link</button>}
          {!done && status === "error" && <button type="button" className="workspace-primary-action mt-6 w-full" onClick={() => setRetry((value) => value + 1)}>Try again</button>}

          <p className="mt-7 text-center text-sm text-slate-600">
            <Link
              to="/login"
              className="font-semibold text-blue-800 underline-offset-4 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Return to sign in
            </Link>
          </p>
        </section>
      </div>
      <ForgotPasswordModal open={showRecovery} onClose={() => setShowRecovery(false)} />

      <footer className="mt-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} HOPE, Inc. All rights reserved.
      </footer>
    </main>
  )
}
