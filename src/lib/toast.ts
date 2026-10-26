export type ToastKind = "success" | "error" | "info"
export type ToastNotice = { id: number; message: string; kind: ToastKind }
export const TOAST_EVENT = "hope:toast"

export function notifyToast(message: string, kind: ToastKind = "success") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<ToastNotice>(TOAST_EVENT, { detail: { id: Date.now() + Math.random(), message, kind } }))
}
