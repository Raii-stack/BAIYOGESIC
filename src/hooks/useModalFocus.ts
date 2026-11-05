import { useEffect, useRef } from "react"
import type { RefObject } from "react"

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

export default function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
  onCancel: () => void,
  dismissalDisabled = false,
) {
  const cancelCallbackRef = useRef(onCancel)
  const dismissalDisabledRef = useRef(dismissalDisabled)
  useEffect(() => { cancelCallbackRef.current = onCancel }, [onCancel])
  useEffect(() => { dismissalDisabledRef.current = dismissalDisabled }, [dismissalDisabled])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    initialFocusRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!dismissalDisabledRef.current) {
          event.preventDefault()
          cancelCallbackRef.current()
        }
        return
      }

      if (event.key !== "Tab") return
      const dialog = dialogRef.current
      if (!dialog) return

      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true")
      if (!controls.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = controls[0]
      const last = controls.at(-1)
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        if (event.shiftKey) last?.focus()
        else first.focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [dialogRef, initialFocusRef, open])
}
