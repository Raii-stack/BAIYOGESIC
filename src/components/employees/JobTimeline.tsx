import type { JobHistoryEntry } from "../../types/employee"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export default function JobTimeline({ entries, showAudit = true }: {
  entries: JobHistoryEntry[]
  showAudit?: boolean
}) {
  if (entries.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">No job history recorded.</p>
  }

  return (
    <ol className="workspace-job-timeline" aria-label="Job history timeline">
      {entries.map((entry, index) => (
        <li key={entry.id} className="workspace-job-timeline-item">
          <div className="workspace-job-timeline-rail" aria-hidden="true">
            <span className="workspace-job-timeline-marker" />
          </div>
          <article className="workspace-job-timeline-card">
            <div className="workspace-job-timeline-date">
              <time dateTime={entry.effectiveDate}>{entry.effectiveDate}</time>
              {index === 0 && <span className="workspace-badge bg-emerald-100 text-emerald-800">Current</span>}
            </div>
            <div className="workspace-job-timeline-assignment">
              <h3>{entry.jobTitle}</h3>
              <p>{entry.department}</p>
            </div>
            <div className="workspace-job-timeline-salary">
              <span>Salary</span>
              <strong>{entry.canViewSalary ? money.format(entry.salary) : <span aria-label="Salary hidden due to permissions">••••••</span>}</strong>
            </div>
            {showAudit && (
              <div className="workspace-job-timeline-audit">
                <span>Last change</span>
                <p>{entry.stamp || "—"}</p>
              </div>
            )}
          </article>
        </li>
      ))}
    </ol>
  )
}
