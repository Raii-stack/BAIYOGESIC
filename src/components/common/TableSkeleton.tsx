export function TableSkeletonRows({ headings, rowCount = 8 }: { headings: string[]; rowCount?: number }) {
  return Array.from({ length: rowCount }, (_, index) => (
    <tr key={index} aria-hidden="true">
      {headings.map((heading) => (
        <td key={heading} data-label={heading}>
          <div className="h-3.5 w-28 max-w-full animate-pulse rounded bg-neutral-200" />
        </td>
      ))}
    </tr>
  ))
}

export default function TableSkeleton({ headings, label }: { headings: string[]; label: string }) {
  return (
    <table role="table" aria-label={label} aria-busy="true" className="workspace-table">
      <thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
      <tbody><TableSkeletonRows headings={headings} rowCount={3} /></tbody>
    </table>
  )
}
