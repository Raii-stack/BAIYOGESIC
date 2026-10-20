import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

import type { Errors } from "../../types/auth"
import { Field, Submit } from "./AuthComponents"
import PasswordStrengthMeter from "./PasswordStrengthMeter"
import { useAuth } from "./AuthProvider"

export default function ChangePasswordModal({ onComplete }: { onComplete: () => void }) {
  const { changePassword, logout, user } = useAuth()
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
      onComplete()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to update your password.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#071b30]/75 p-4 sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        aria-describedby="change-password-description"
        onKeyDown={trapFocus}
        className="w-full max-w-lg border border-slate-300 border-t-[3px] border-t-blue-900 bg-white px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.25)] sm:px-9 sm:py-9"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
          Account security
        </p>
        <h2 id="change-password-title" className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Change your default password
        </h2>
        <p id="change-password-description" className="mt-3 text-sm leading-6 text-slate-600">
          {user?.email} must set a personal password before entering the workspace.
        </p>

        <form onSubmit={submit} noValidate className="mt-6">
          <Field
            id="change-current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your default password"
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
          <Submit loading={saving} loadingLabel="Updating password…">Update password</Submit>
        </form>
        <button
          type="button"
          onClick={() => logout().catch((error: unknown) => {
            setServerError(error instanceof Error ? error.message : "Unable to sign out.")
          })}
          className="mt-5 w-full text-center text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
