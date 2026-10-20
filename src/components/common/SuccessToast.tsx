import { useEffect, useRef } from "react"

export default function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current(), 4500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div role="status" className="fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-lg border border-emerald-200 bg-white p-4 text-emerald-950 shadow-[0_16px_48px_rgba(15,39,67,0.18)] sm:right-6 sm:top-6">
      <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 4 4 8-8" /></svg>
      </span>
      <p className="flex-1 pt-0.5 text-sm font-semibold leading-5">{message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss notification" className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
      </button>
    </div>
  )
}
