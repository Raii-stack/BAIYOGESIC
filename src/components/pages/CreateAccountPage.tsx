import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"

import type { Errors } from "../../types/auth"
import { emailOk } from "../../utils/validation"
import {
  AuthShell,
  Field,
  RoleField,
  Submit,
  SuccessMessage,
  useFakeSubmission,
} from "../auth/AuthComponents"

export default function CreateAccountPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first: "",
    last: "",
    email: "",
    role: "",
    password: "",
    confirm: "",
  })
  const [errors, setErrors] = useState<Errors>({})
  const submission = useFakeSubmission()
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!form.first.trim()) nextErrors.first = "First name is required."
    if (!form.last.trim()) nextErrors.last = "Last name is required."
    if (!emailOk(form.email))
      nextErrors.email = "Enter a valid work email address."
    if (!form.role) nextErrors.role = "Select an ERP access level."
    if (form.password.length < 8)
      nextErrors.password = "Use at least 8 characters."
    if (!form.confirm || form.confirm !== form.password)
      nextErrors.confirm = "Passwords do not match."
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) {
      submission.run(() => navigate("/dashboard"))
    }
  }

  return (
    <AuthShell
      page="create"
      title="Create an employee account"
      subtitle="Provision a managed ERP identity for a member of your organization."
    >
      <div className="mb-7 border-l-2 border-amber-500 bg-amber-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
          Restricted action
        </p>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          Only authorized Human Resources staff and system administrators may
          create accounts.
        </p>
      </div>

      <form onSubmit={submit} noValidate>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field
            id="account-first"
            label="First name"
            autoComplete="given-name"
            placeholder="First name"
            icon="user"
            value={form.first}
            onChange={set("first")}
            error={errors.first}
          />
          <Field
            id="account-last"
            label="Last name"
            autoComplete="family-name"
            placeholder="Last name"
            icon="user"
            value={form.last}
            onChange={set("last")}
            error={errors.last}
          />
        </div>
        <Field
          id="account-email"
          label="Employee work email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          icon="mail"
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <RoleField
          value={form.role}
          onChange={set("role")}
          error={errors.role}
        />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field
            id="account-password"
            label="Temporary password"
            type="password"
            autoComplete="new-password"
            placeholder="8+ characters"
            icon="lock"
            passwordToggle
            value={form.password}
            onChange={set("password")}
            error={errors.password}
          />
          <Field
            id="account-confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            icon="lock"
            passwordToggle
            value={form.confirm}
            onChange={set("confirm")}
            error={errors.confirm}
          />
        </div>
        <div className="mt-1">
          <Submit loading={submission.loading} loadingLabel="Creating account…">
            Create account
          </Submit>
        </div>
        {submission.done && (
          <SuccessMessage>
            Account created. Access details are ready to share with the
            employee.
          </SuccessMessage>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Returning to your workspace?{" "}
        <Link
          to="/"
          className="font-semibold text-blue-800 underline-offset-4 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
