type RecordEmptyStateProps = {
  kind: "customers" | "products"
  filtered: boolean
  canCreate: boolean
  onClearFilters: () => void
  onCreate: () => void
}

function EmptyStateIllustration({ kind }: { kind: RecordEmptyStateProps["kind"] }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 88" className="h-24 w-32 text-blue-700" fill="none">
      <rect x="11" y="17" width="82" height="58" rx="10" className="fill-blue-50 stroke-blue-200" strokeWidth="2" />
      {kind === "customers" ? (
        <>
          <circle cx="43" cy="39" r="9" className="fill-white stroke-current" strokeWidth="2" />
          <path d="M27 63c2-10 8-15 16-15s14 5 16 15" className="fill-white stroke-current" strokeWidth="2" strokeLinecap="round" />
          <path d="M69 34h13M69 44h13M69 54h9" className="stroke-blue-400" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="m30 38 20-11 20 11-20 11-20-11Z" className="fill-white stroke-current" strokeWidth="2" strokeLinejoin="round" />
          <path d="m30 38 20 11 20-11v21L50 70 30 59V38Z" className="fill-white stroke-current" strokeWidth="2" strokeLinejoin="round" />
          <path d="M50 49v21" className="stroke-current" strokeWidth="2" />
        </>
      )}
      <circle cx="91" cy="67" r="16" className="fill-white stroke-blue-300" strokeWidth="2" />
      <path d="m102 78 10 8M85 67h12" className="stroke-blue-700" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function RecordEmptyState({ kind, filtered, canCreate, onClearFilters, onCreate }: RecordEmptyStateProps) {
  const singular = kind === "customers" ? "customer" : "product"
  const title = filtered ? `No ${kind} match your filters` : `No ${kind} yet`
  const description = filtered
    ? `Clear the search and filters to see the full ${singular} list.`
    : canCreate
      ? `Add your first ${singular} to start building this directory.`
      : `There are no ${kind} available to view.`

  return (
    <div className="workspace-empty-state flex flex-col items-center" role="status" aria-live="polite">
      <EmptyStateIllustration kind={kind} />
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      {filtered ? (
        <button type="button" onClick={onClearFilters} className="workspace-secondary-action mt-5">Clear filters</button>
      ) : canCreate ? (
        <button type="button" onClick={onCreate} className="workspace-primary-action mt-5">Add {singular}</button>
      ) : null}
    </div>
  )
}
