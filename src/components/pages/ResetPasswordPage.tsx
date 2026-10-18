import { useState, type FormEvent } from "react"
import { Link } from "react-router"

import { changePassword, getCurrentUser, getUserDisplayName } from "../../lib/auth"
import type { Errors } from "../../types/auth"
import {
  Field,
  Logo,
  Submit,
  SuccessMessage,
} from "../auth/AuthComponents"
import PasswordStrengthMeter from "../auth/PasswordStrengthMeter"

export default function ResetPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const user = getCurrentUser()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!user) nextErrors.session = "Sign in before changing your password."
    if (!currentPassword) nextErrors.current = "Current password is required."
    if (password.length < 8) nextErrors.password = "Use at least 8 characters."
    if (!confirm || confirm !== password) {
      nextErrors.confirm = "Passwords do not match."
    }
    setErrors(nextErrors)
    setSubmitError("")
    setDone(false)
    if (Object.keys(nextErrors).length) return

    setLoading(true)
    try {
      await changePassword(currentPassword, password)
      setDone(true)
      setCurrentPassword("")
      setPassword("")
      setConfirm("")
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to update your password.",
      )
    } finally {
      setLoading(false)
    }
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
              Change your password
            </h1>
            <div className="mt-4 border-l-2 border-blue-600 bg-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-900">
                {user ? `Signed in as ${getUserDisplayName(user)}.` : "Sign in is required."}
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                {user
                  ? "Use your current password to create a new one."
                  : "Return to sign in, then open this page again to change your password."}
              </p>
            </div>
          </div>

          <form onSubmit={submit} noValidate className="mt-7">
            <Field
              id="reset-current-password"
              label="Current Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your current password"
              icon="lock"
              passwordToggle
              value={currentPassword}
              onChange={setCurrentPassword}
              error={errors.current || errors.session}
            />
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
              <Submit loading={loading} loadingLabel="Updating password…">
                Update Password
              </Submit>
            </div>
            {submitError && (
              <p role="alert" className="mt-4 text-sm font-medium text-red-600">
                {submitError}
              </p>
            )}
            {done && (
              <SuccessMessage>
                Password updated successfully.
              </SuccessMessage>
            )}
          </form>

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
