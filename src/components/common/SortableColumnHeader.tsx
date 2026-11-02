import type { SortOrder } from "../../lib/table-sorting"

export default function SortableColumnHeader({ label, active, order, onSort, align = "left" }: {
  label: string
  active: boolean
  order: SortOrder
  onSort: () => void
  align?: "left" | "right"
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={`workspace-table-heading ${align === "right" ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={onSort}
        aria-label={`Sort by ${label}${active ? `, currently ${order === "asc" ? "ascending" : "descending"}` : ""}`}
        className={`inline-flex w-full items-center gap-1 rounded-sm text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${align === "right" ? "justify-end" : "justify-start"}`}
      >
        <span>{label}</span>
        <svg aria-hidden="true" viewBox="0 0 12 14" className={`h-3.5 w-3 shrink-0 ${active ? "text-neutral-900" : "text-neutral-400"}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {active && order === "asc" ? <path d="m3 8 3-3 3 3" />
            : active ? <path d="m3 6 3 3 3-3" />
              : <><path d="m3 5 3-3 3 3" /><path d="m3 9 3 3 3-3" /></>}
        </svg>
      </button>
    </th>
  )
}
