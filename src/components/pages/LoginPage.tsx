import { useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router"

import { useAuth } from "../auth/AuthProvider"
import ChangePasswordModal from "../auth/ChangePasswordModal"
import type { Errors } from "../../types/auth"
import { emailOk } from "../../utils/validation"
import {
  AuthShell,
  Field,
  Submit,
} from "../auth/AuthComponents"

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [authenticationError, setAuthenticationError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!emailOk(email)) nextErrors.email = "Enter a valid work email address."
    if (!password) nextErrors.password = "Password is required."
    setErrors(nextErrors)
    setAuthenticationError("")
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      const signedInUser = await login(email, password)
      setPassword("")
      if (!signedInUser.mustChangePassword) navigate("/dashboard", { replace: true })
    } catch (error) {
      setAuthenticationError(error instanceof Error ? error.message : "Unable to sign in.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div role="status" className="grid min-h-screen place-items-center bg-[#edf1f5] text-sm text-slate-600">Checking your session…</div>
  if (user && !user.mustChangePassword) return <Navigate to="/dashboard" replace />

  return (
    <AuthShell
      page="login"
      title="Sign in to your workspace"
      subtitle="Use your corporate credentials to continue to your organization."
    >
      <form onSubmit={submit} noValidate>
        <Field
          id="login-email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          icon="mail"
          value={email}
          onChange={(value) => {
            setEmail(value)
            if (authenticationError) setAuthenticationError("")
          }}
          error={errors.email}
        />
        <Field
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          icon="lock"
          passwordToggle
          value={password}
          onChange={(value) => {
            setPassword(value)
            if (authenticationError) setAuthenticationError("")
          }}
          error={errors.password}
        />
        <div className="mb-6 flex items-center justify-end">
          <Link
            to="/reset-password"
            className="text-[13px] font-semibold text-blue-800 transition hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Forgot password?
          </Link>
        </div>
        {authenticationError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 border border-red-200 border-l-[3px] border-l-red-600 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-800"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v5M10 14h.01" />
            </svg>
            {authenticationError}
          </div>
        )}
        <Submit loading={submitting} loadingLabel="Signing you in…">
          Sign in
        </Submit>
      </form>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-sm text-slate-600">
          Authorized HR or system administrator?{" "}
          <Link
            to="/create-account"
            className="font-semibold text-blue-800 underline-offset-4 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Create an account
          </Link>
        </p>
      </div>
      {user?.mustChangePassword && (
        <ChangePasswordModal onComplete={() => navigate("/dashboard", { replace: true })} />
      )}
    </AuthShell>
  )
}
