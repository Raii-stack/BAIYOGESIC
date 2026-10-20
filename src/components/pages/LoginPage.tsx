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
        {authenticationError && <p role="alert" className="mb-4 text-[13px] font-medium leading-5 text-red-700">{authenticationError}</p>}
        <Submit loading={submitting} loadingLabel="Signing you in…">
          Sign in
        </Submit>
      </form>

      {user?.mustChangePassword && (
        <ChangePasswordModal onComplete={() => navigate("/dashboard", { replace: true })} />
      )}
    </AuthShell>
  )
}
