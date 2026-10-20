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
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${
          inverse
            ? "border-white/20 bg-white text-[#0d2743]"
            : "border-blue-900 bg-blue-900 text-white"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M6 4v16M18 4v16M6 12h12" />
        </svg>
      </div>
      <div>
        <div
          className={`text-lg font-bold tracking-tight ${
            inverse ? "text-white" : "text-slate-950"
          }`}
        >
          HOPE, Inc.
        </div>
        <div
          className={`mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            inverse ? "text-blue-200" : "text-slate-500"
          }`}
        >
          Enterprise Resource Planning
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
}) {
  const [visible, setVisible] = useState(false)
  const errorId = `${id}-error`
  const inputType = passwordToggle && visible ? "text" : type

  return (
    <div className="mb-5">
      <label
        htmlFor={id}
        className="mb-2 block text-[13px] font-semibold text-slate-700"
      >
        {label}
      </label>
      <div className="group relative">
        <Icon
          name={icon}
          className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-colors ${
            error
              ? "text-red-500"
              : "text-slate-400 group-focus-within:text-blue-800"
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
          className={`h-12 w-full rounded-lg border bg-white pl-11 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
            passwordToggle ? "pr-12" : "pr-4"
          } ${
            error
              ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
              : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
          }`}
        />
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
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
    <div className="mb-5">
      <label
        htmlFor="account-role"
        className="mb-2 block text-[13px] font-semibold text-slate-700"
      >
        ERP role
      </label>
      <div className="group relative">
        <Icon
          name="briefcase"
          className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${
            error
              ? "text-red-500"
              : "text-slate-400 group-focus-within:text-blue-800"
          }`}
        />
        <select
          id="account-role"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="account-role-error"
          className={`h-12 w-full appearance-none rounded-lg border bg-white pl-11 pr-10 text-sm outline-none transition ${
            value ? "text-slate-950" : "text-slate-400"
          } ${
            error
              ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
              : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
          }`}
        >
          <option value="">Select access level</option>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="hr">Human Resources</option>
          <option value="administrator">Administrator</option>
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
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
      className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:bg-blue-700"
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
        />
      )}
      {loading ? loadingLabel : children}
      {!loading && (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10h12m-4-4 4 4-4 4" />
        </svg>
      )}
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

const pageDetails = {
  login: {
    index: "01",
    label: "Authentication",
    heading: "Your work. One secure entry.",
    copy: "A focused gateway to the systems, workflows, and records your organization relies on.",
    points: [
      "Protected enterprise session",
      "Organization-managed access",
      "Centralized ERP workspace",
    ],
  },
  create: {
    index: "02",
    label: "Account control",
    heading: "Access starts with accountable setup.",
    copy: "Create a managed ERP identity and assign the correct access level from the start.",
    points: [
      "Restricted to HR and administrators",
      "Role-based permissions",
      "Auditable account ownership",
    ],
  },
}

export function AuthShell({
  page,
  title,
  subtitle,
  children,
}: {
  page: keyof typeof pageDetails
  title: string
  subtitle: string
  children: ReactNode
}) {
  const headingId = useId()
  const details = pageDetails[page]

  return (
    <main className="flex min-h-screen flex-col bg-[#edf1f5] px-4 py-5 font-sans antialiased sm:px-6 sm:py-8 lg:grid lg:place-items-center lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_24px_70px_rgba(15,39,67,0.10)] lg:grid lg:min-h-[720px] lg:flex-none lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="relative hidden min-h-[300px] flex-col bg-[#0d2743] p-7 text-white sm:p-10 lg:flex lg:min-h-full lg:p-12">
          <Logo inverse />

          <div className="my-auto max-w-sm py-12 lg:py-20">
            <div className="mb-7 flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">
              <span className="text-4xl font-light tracking-[-0.05em] text-white/30">
                {details.index}
              </span>
              <span className="h-px w-10 bg-blue-300/50" />
              {details.label}
            </div>
            <p className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              {details.heading}
            </p>
            <p className="mt-5 max-w-xs text-sm leading-6 text-slate-300">
              {details.copy}
            </p>
          </div>

          <ul className="grid gap-2 border-t border-white/15 pt-6 text-xs font-medium text-slate-300">
            {details.points.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 bg-blue-300" />
                {point}
              </li>
            ))}
          </ul>
        </aside>

        <section
          aria-labelledby={headingId}
          className="flex flex-1 items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-16 xl:px-20"
        >
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-8 text-center lg:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-800">
                HOPE secure identity
              </p>
              <h1
                id={headingId}
                className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-[34px]"
              >
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </section>
      </div>

      <footer className="mx-auto mt-5 flex w-full max-w-6xl flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
        <p>© {new Date().getFullYear()} HOPE, Inc. All rights reserved.</p>
        <nav
          aria-label="Legal and support links"
          className="flex items-center gap-5"
        >
          <a
            href="#privacy"
            className="transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Privacy
          </a>
          <a
            href="#security"
            className="transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Security
          </a>
          <a
            href="#support"
            className="transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Support
          </a>
        </nav>
      </footer>
    </main>
  )
}
