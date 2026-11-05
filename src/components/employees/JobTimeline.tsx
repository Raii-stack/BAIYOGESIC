import CareerTimeline from "./CareerTimeline"
import type { JobHistoryEntry } from "../../types/employee"

export default function JobTimeline({
  entries,
  showAudit = true,
  canViewSalary,
}: {
  entries: JobHistoryEntry[]
  showAudit?: boolean
  canViewSalary?: boolean
}) {
  return (
    <CareerTimeline
      entries={entries}
      showAudit={showAudit}
      canViewSalary={canViewSalary}
    />
  )
}
