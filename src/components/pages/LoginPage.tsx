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
  const submission = useFakeSubmission()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!emailOk(email)) nextErrors.email = "Enter a valid work email address."
    if (!password) nextErrors.password = "Password is required."
    setErrors(nextErrors)
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
          onChange={setEmail}
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
          onChange={setPassword}
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
