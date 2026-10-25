import { useId, useState, type ReactNode } from "react"

import type { IconName } from "../../types/auth"

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName
  className?: string
}) {
  const paths: Record<IconName, ReactNode> = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    lock: (
      <>
        <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2.5" />
        <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden && <path d="m4 4 16 16" className="stroke-[2.2]" />}
    </svg>
  )
}

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <img src="/assets/hope-mark.svg" alt="HOPE logo" width="44" height="44" className="h-11 w-11 shrink-0" />
      <div>
        <div
          className={`text-base font-semibold tracking-tight ${
            inverse ? "text-white" : "text-slate-950"
          }`}
        >
          HOPE, Inc.
        </div>
        <div
          className={`mt-0.5 text-xs font-normal ${
            inverse ? "text-blue-200" : "text-slate-500"
          }`}
        >
          Business workspace
        </div>
      </div>
    </div>
  )
}

export function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  icon,
  placeholder,
  passwordToggle = false,
  className = "mb-4",
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoComplete?: string
  icon: IconName
  placeholder: string
  passwordToggle?: boolean
  className?: string
}) {
  const [visible, setVisible] = useState(false)
  const errorId = `${id}-error`
  const inputType = passwordToggle && visible ? "text" : type

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="workspace-label"
      >
        {label}
      </label>
      <div className="group relative">
        <Icon
          name={icon}
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
            error
              ? "text-red-500"
              : "text-neutral-400 group-focus-within:text-neutral-700"
          }`}
        />
        <input
          id={id}
          type={inputType}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`workspace-control workspace-control--search ${
            passwordToggle ? "workspace-control--password" : ""
          } ${
            error
              ? "border-red-500"
              : "border-neutral-400"
          }`}
        />
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-neutral-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <EyeIcon hidden={visible} />
          </button>
        )}
      </div>
      <p
        id={errorId}
        aria-live="polite"
        className={
          error
            ? "mt-2 text-xs font-medium leading-4 text-red-600"
            : "sr-only"
        }
      >
        {error}
      </p>
    </div>
  )
}

export function RoleField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor="account-role"
        className="workspace-label"
      >
        ERP role
      </label>
      <div className="group relative">
        <Icon
          name="briefcase"
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
            error
              ? "text-red-500"
              : "text-neutral-400 group-focus-within:text-neutral-700"
          }`}
        />
        <select
          id="account-role"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="account-role-error"
          className={`workspace-control workspace-control--search ${
            value ? "text-slate-950" : "text-neutral-400"
          } ${
            error
              ? "border-red-500"
              : "border-neutral-400"
          }`}
        >
          <option value="">Select access level</option>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="hr">Human Resources</option>
          <option value="administrator">Administrator</option>
        </select>
      </div>
      <p
        id="account-role-error"
        aria-live="polite"
        className={
          error
            ? "mt-2 text-xs font-medium leading-4 text-red-600"
            : "sr-only"
        }
      >
        {error}
      </p>
    </div>
  )
}

export function Submit({
  loading,
  children,
  loadingLabel,
}: {
  loading: boolean
  children: ReactNode
  loadingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="workspace-primary-action w-full"
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
        />
      )}
      {loading ? loadingLabel : children}
    </button>
  )
}

export function useFakeSubmission() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const run = (onComplete?: () => void) => {
    setLoading(true)
    setDone(false)
    window.setTimeout(() => {
      setLoading(false)
      setDone(true)
      onComplete?.()
    }, 1400)
  }

  return { loading, done, run }
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-2.5 border-l-2 border-emerald-600 bg-emerald-50 px-3.5 py-3 text-sm font-medium leading-5 text-emerald-900"
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
        <path d="m6.5 10 2.2 2.2 4.8-5" />
      </svg>
      {children}
    </div>
  )
}

export function AuthShell({
  page,
  title,
  subtitle,
  children,
}: {
  page: "login" | "create"
  title: string
  subtitle: string
  children: ReactNode
}) {
  const headingId = useId()

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f7] font-sans text-neutral-900 antialiased">
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <section aria-labelledby={headingId} className="workspace-panel w-full max-w-[440px] p-6 sm:p-8">
          <Logo />
          <div className="mb-6 mt-8">
            <h1 id={headingId} className="text-2xl font-semibold tracking-[-0.5px] text-neutral-900">{title}</h1>
            <p className="mt-2 text-[13px] leading-5 text-neutral-500">{subtitle}</p>
          </div>
          {children}
          {page === "login" && <p className="mt-6 border-t border-neutral-100 pt-5 text-xs leading-5 text-neutral-500">Need access? Contact your administrator.</p>}
        </section>
      </main>
      <footer className="px-5 pb-6 text-center text-xs text-neutral-500">© {new Date().getFullYear()} HOPE, Inc. All rights reserved.</footer>
    </div>
  )
}
