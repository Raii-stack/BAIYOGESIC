import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"

import { authApi } from "../../lib/auth"
import { safeErrorMessage } from "../../lib/api-errors"
import { notifyToast } from "../../lib/toast"
import type { Errors } from "../../types/auth"
import {
  Field,
  Logo,
  Submit,
} from "../auth/AuthComponents"
import PasswordStrengthMeter from "../auth/PasswordStrengthMeter"

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
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
      notifyToast(safeErrorMessage(error), "error")
    } finally { setSubmitting(false) }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#edf1f5] px-4 py-6 font-sans text-slate-950 antialiased sm:px-6 sm:py-10">
      <div className="flex flex-1 items-center justify-center">
        <section
          aria-labelledby="reset-password-heading"
          className="w-full max-w-[520px] border border-slate-300 border-t-[3px] border-t-blue-900 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,39,67,0.10)] sm:px-10 sm:py-10"
        >
          <Logo />

          <div className="mt-9">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
              Secure password reset
            </p>
            <h1
              id="reset-password-heading"
              className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950"
            >
              Create New Password
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">{token ? "Choose a new password using your reset link." : "A valid password-reset link is required. Contact your administrator to request one."}</p>
          </div>

          {token && !done && <form onSubmit={submit} noValidate className="mt-7">
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

          <p className="mt-7 text-center text-sm text-slate-600">
            <Link
              to="/"
              className="font-semibold text-blue-800 underline-offset-4 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Return to sign in
            </Link>
          </p>
        </section>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} HOPE, Inc. All rights reserved.
      </footer>
    </main>
  )
}
