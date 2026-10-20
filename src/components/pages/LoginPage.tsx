import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"

import type { Errors } from "../../types/auth"
import { emailOk } from "../../utils/validation"
import {
  AuthShell,
  Field,
  Submit,
  SuccessMessage,
  useFakeSubmission,
} from "../auth/AuthComponents"

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [authenticationError, setAuthenticationError] = useState("")
  const submission = useFakeSubmission()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!emailOk(email)) nextErrors.email = "Enter a valid work email address."
    if (!password) nextErrors.password = "Password is required."
    setErrors(nextErrors)
    setAuthenticationError(
      Object.keys(nextErrors).length
        ? "Invalid credentials. Account will lock after 2 more failed attempts"
        : "",
    )
    if (!Object.keys(nextErrors).length) {
      submission.run(() => navigate("/dashboard"))
    }
  }

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
        <div className="mb-6 flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            />
            Remember me
          </label>
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
            Invalid credentials. Account will lock after 2 more failed attempts
          </div>
        )}
        <Submit loading={submission.loading} loadingLabel="Signing you in…">
          Sign in
        </Submit>
        {submission.done && (
          <SuccessMessage>
            Signed in successfully. Redirecting to your workspace.
          </SuccessMessage>
        )}
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
    </AuthShell>
  )
}
