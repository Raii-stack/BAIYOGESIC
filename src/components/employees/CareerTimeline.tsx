import { useState } from "react"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import type { JobHistoryEntry } from "../../types/employee"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export type CareerTimelineProps = {
  entries: JobHistoryEntry[]
  loading?: boolean
  showAudit?: boolean
  canViewSalary?: boolean
  revealed?: boolean
  onToggleReveal?: () => void
}

export function CareerTimelineSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading career timeline"
      className="space-y-6 p-6"
    >
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-1 h-20 w-0.5 animate-pulse bg-slate-200" />
          </div>
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CareerTimeline({
  entries,
  loading = false,
  showAudit = true,
  canViewSalary,
  revealed: controlledRevealed,
  onToggleReveal,
}: CareerTimelineProps) {
  const [internalRevealed, setInternalRevealed] = useState(true)
  const isControlled = controlledRevealed !== undefined
  const isRevealed = isControlled ? controlledRevealed : internalRevealed

  const toggleReveal = () => {
    if (onToggleReveal) {
      onToggleReveal()
    } else {
      setInternalRevealed((prev) => !prev)
    }
  }

  // Determine if active user is authorized to view compensation
  const isSalaryAuthorized =
    canViewSalary !== undefined
      ? canViewSalary
      : entries.some((e) => e.canViewSalary)

  if (loading) {
    return <CareerTimelineSkeleton />
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center px-5 py-12 text-center"
        data-testid="career-timeline-empty"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <DashboardIcon name="history" className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          No job history recorded.
        </p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          This employee is on their initial job assignment with no previous promotions or department transfers.
        </p>
      </div>
    )
  }

  // Sort descending by effectiveDate so newest assignment is first
  const sortedEntries = [...entries].sort((a, b) =>
    (b.effectiveDate || "").localeCompare(a.effectiveDate || "")
  )

  return (
    <ol className="workspace-job-timeline" aria-label="Job history timeline">
      {sortedEntries.map((entry, index) => {
        const isCurrent = index === 0
        const previousEntry = sortedEntries[index + 1]
        const isPromotion =
          previousEntry && entry.jobTitle !== previousEntry.jobTitle
        const isTransfer =
          previousEntry && entry.department !== previousEntry.department

        return (
          <li key={entry.id} className="workspace-job-timeline-item">
            <div className="workspace-job-timeline-rail" aria-hidden="true">
              <span
                className={`workspace-job-timeline-marker ${
                  isCurrent ? "bg-emerald-600 ring-4 ring-emerald-100" : ""
                }`}
              />
            </div>
            <article className="workspace-job-timeline-card">
              <div className="workspace-job-timeline-date">
                <time dateTime={entry.effectiveDate}>{entry.effectiveDate}</time>
                <div className="flex flex-wrap items-center gap-1.5">
                  {isCurrent && (
                    <span className="workspace-badge bg-emerald-100 text-emerald-800">
                      Current
                    </span>
                  )}
                  {isPromotion && (
                    <span
                      className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                      title="Job title adjustment"
                    >
                      Promotion
                    </span>
                  )}
                  {isTransfer && (
                    <span
                      className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700"
                      title="Department transfer"
                    >
                      Transfer
                    </span>
                  )}
                </div>
              </div>

              <div className="workspace-job-timeline-assignment">
                <h3>{entry.jobTitle}</h3>
                <p>
                  <span className="workspace-badge workspace-badge--neutral">
                    {entry.department}
                  </span>
                </p>
              </div>

              <div className="workspace-job-timeline-salary">
                <div className="flex items-center justify-between">
                  <span>Salary</span>
                  {isSalaryAuthorized && !isControlled && (
                    <button
                      type="button"
                      onClick={toggleReveal}
                      aria-label={isRevealed ? "Hide salary" : "Show salary"}
                      title={isRevealed ? "Hide salary" : "Show salary"}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <DashboardIcon
                        name={isRevealed ? "eyeOff" : "eye"}
                        className="h-3.5 w-3.5"
                      />
                    </button>
                  )}
                </div>
                <strong>
                  {isSalaryAuthorized && isRevealed && entry.canViewSalary ? (
                    money.format(entry.salary)
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-slate-500"
                      aria-label="Salary hidden due to permissions"
                    >
                      <DashboardIcon name="lock" className="h-3.5 w-3.5 text-slate-400" />
                      ••••••••
                    </span>
                  )}
                </strong>
              </div>

              {showAudit && (
                <div className="workspace-job-timeline-audit">
                  <span>Last change</span>
                  <p>{entry.stamp || "—"}</p>
                </div>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}
