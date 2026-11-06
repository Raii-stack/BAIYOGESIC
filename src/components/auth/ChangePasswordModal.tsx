import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

import type { Errors } from "../../types/auth"
import { Field, Submit } from "./AuthComponents"
import PasswordStrengthMeter from "./PasswordStrengthMeter"
import { useAuth } from "./AuthProvider"
import { notifyToast } from "../../lib/toast"

export default function ChangePasswordModal({ onClose }: { onClose?: () => void } = {}) {
  const { changePassword, logout } = useAuth()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.getElementById("change-current-password")?.focus()
  }, [])

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onClose && !saving) { event.preventDefault(); onClose(); return }
    if (event.key !== "Tab") return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input, button:not([disabled])',
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!currentPassword) nextErrors.currentPassword = "Enter your current password."
    if (newPassword.length < 8) nextErrors.newPassword = "Use at least 8 characters."
    else if (newPassword === currentPassword) nextErrors.newPassword = "Choose a different password."
    if (confirmPassword !== newPassword) nextErrors.confirmPassword = "Passwords do not match."
    setErrors(nextErrors)
    setServerError("")
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      notifyToast("Password changed successfully.")
      onClose?.()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to update your password.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace-modal-overlay z-50 bg-black/45">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        aria-describedby="change-password-description"
        onKeyDown={trapFocus}
        className="workspace-modal workspace-panel w-full max-w-[440px] shadow-xl"
      >
        <header className="workspace-drawer-header">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              Account security
            </p>
            <h2 id="change-password-title" className="mt-3 text-xl font-semibold tracking-[-0.4px] text-neutral-900">
              {onClose ? "Change password" : "Set a new password"}
            </h2>
            <p id="change-password-description" className="mt-2 text-[13px] leading-5 text-neutral-500">
              {onClose ? "Choose a new password to secure your account." : "You’re signed in with a temporary password. Create a personal password to secure your account."}
            </p>
          </div>
        </header>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="workspace-drawer-body">
            <Field
              id="change-current-password"
              label="Current password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your current password"
              icon="lock"
              passwordToggle
              value={currentPassword}
              onChange={setCurrentPassword}
              error={errors.currentPassword}
            />
            <Field
              id="change-new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a new password"
              icon="lock"
              passwordToggle
              value={newPassword}
              onChange={setNewPassword}
              error={errors.newPassword}
            />
            <PasswordStrengthMeter password={newPassword} />
            <Field
              id="change-confirm-password"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your new password"
              icon="lock"
              passwordToggle
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
            />
            {serverError && <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{serverError}</p>}
          </div>
          <footer className="workspace-drawer-footer">
            <Submit loading={saving} loadingLabel="Updating password…">Update password</Submit>
            {onClose ? <button type="button" disabled={saving} onClick={onClose} className="workspace-secondary-action w-full">Cancel</button> :
            <button
              type="button"
              onClick={() => logout().catch((error: unknown) => {
                setServerError(error instanceof Error ? error.message : "Unable to sign out.")
              })}
              className="workspace-secondary-action w-full"
            >
              Sign out
            </button>}
          </footer>
        </form>
      </div>
    </div>
  )
}
