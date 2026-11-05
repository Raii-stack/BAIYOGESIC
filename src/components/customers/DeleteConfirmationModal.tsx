import { useRef } from "react"

import useModalFocus from "../../hooks/useModalFocus"

type DeleteConfirmationModalProps = {
  customerName: string
  open: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
  loading: boolean
  error: string
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" />
      <path d="M12 9v5M12 18h.01" />
    </svg>
  )
}

export default function DeleteConfirmationModal({
  customerName,
  open,
  onCancel,
  onConfirm,
  loading,
  error,
}: DeleteConfirmationModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useModalFocus(open, dialogRef, cancelRef, onCancel, loading)

  if (!open) return null

  return (
    <div className="workspace-modal-overlay z-[60]">
      <button
        type="button"
        aria-label="Cancel archive"
        tabIndex={-1}
        onClick={() => { if (!loading) onCancel() }}
        className="absolute inset-0 bg-black/45"
      />

      <section
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="archive-dialog-title"
        aria-describedby={`archive-dialog-description${error ? " archive-customer-error" : ""}`}
        aria-busy={loading}
        className="workspace-modal workspace-panel relative w-full max-w-lg shadow-xl"
      >
        <div className="workspace-drawer-body text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700">
            <WarningIcon />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">
            Destructive action
          </p>
          <h2
            id="archive-dialog-title"
            className="mt-2 text-xl font-semibold tracking-tight text-neutral-900"
          >
            Archive this record?
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {customerName}
          </p>
          <p
            id="archive-dialog-description"
            className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600"
          >
            Archive this customer? The record will stay in the directory with
            Archived status. Customers with active sales cannot be archived.
          </p>
        </div>

        {error && <p id="archive-customer-error" role="alert" className="px-6 pb-4 text-sm font-semibold text-red-700">{error}</p>}
        <div className="workspace-drawer-footer">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="workspace-secondary-action"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="workspace-danger-action"
          >
            {loading ? "Archiving…" : "Yes, Archive Record"}
          </button>
        </div>
      </section>
    </div>
  )
}
