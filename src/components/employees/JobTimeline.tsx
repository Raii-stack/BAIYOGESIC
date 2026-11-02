import CareerTimeline from "./CareerTimeline"
import type { JobHistoryEntry } from "../../types/employee"

export default function JobTimeline({
  entries,
  showAudit = true,
}: {
  entries: JobHistoryEntry[]
  showAudit?: boolean
}) {
  return <CareerTimeline entries={entries} showAudit={showAudit} />
}
