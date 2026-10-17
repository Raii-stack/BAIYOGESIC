import { useState, type FormEvent } from "react"

import type { Errors } from "../../types/auth"
import { changePassword, getCurrentUser, saveCurrentUser } from "../../lib/auth"
import PasswordStrengthMeter from "./PasswordStrengthMeter"
import { Field, Submit } from "./AuthComponents"

type ChangePasswordModalProps = {
  open: boolean
  required?: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ChangePasswordModal({
  open,
  required = false,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!currentPassword) nextErrors.current = "Current password is required."
    if (newPassword.length < 8) nextErrors.password = "Use at least 8 characters."
    if (!confirmPassword || confirmPassword !== newPassword) {
      nextErrors.confirm = "Passwords do not match."
    }
    setErrors(nextErrors)
    setSubmitError("")
    if (Object.keys(nextErrors).length) return

    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      const user = getCurrentUser()
      if (user) saveCurrentUser({ ...user, mustChangePassword: false })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      onSuccess()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to update your password.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-lg border border-slate-300 border-t-[3px] border-t-blue-900 bg-white p-6 shadow-[0_20px_60px_rgba(15,39,67,0.2)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Account security
            </p>
            <h2
              id="change-password-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {required ? "Set your password" : "Change password"}
            </h2>
          </div>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close change password dialog"
              className="text-2xl leading-none text-slate-400 hover:text-slate-800"
            >
              ×
            </button>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {required
            ? "You are using the temporary password. Choose a new password before continuing."
            : "Use your current password to set a new password for this account."}
        </p>

        <form onSubmit={submit} noValidate className="mt-6">
          <Field
            id="current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter current password"
            icon="lock"
            passwordToggle
            value={currentPassword}
            onChange={setCurrentPassword}
            error={errors.current}
          />
          <Field
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter a secure password"
            icon="lock"
            passwordToggle
            value={newPassword}
            onChange={setNewPassword}
            error={errors.password}
          />
          <PasswordStrengthMeter password={newPassword} />
          <Field
            id="confirm-new-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            icon="lock"
            passwordToggle
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={errors.confirm}
          />
          {submitError && (
            <p role="alert" className="mb-4 text-sm font-medium text-red-600">
              {submitError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <Submit loading={loading} loadingLabel="Updating password…">
              Update password
            </Submit>
          </div>
        </form>
      </section>
    </div>
  )
}
