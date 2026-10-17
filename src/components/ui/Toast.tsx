type ToastProps = {
  message: string
  onDismiss: () => void
}

export default function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-[0_12px_30px_rgba(15,39,67,0.18)]"
    >
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        ✓
      </span>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-lg leading-4 text-slate-400 hover:text-slate-700"
      >
        ×
      </button>
    </div>
  )
}
