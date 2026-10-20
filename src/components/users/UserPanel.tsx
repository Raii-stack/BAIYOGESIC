import { useEffect, useState, type FormEvent } from "react"

import type { UserCreateInput, UserUpdateInput } from "../../lib/user-api"
import { departmentPermissionPresets } from "../../lib/users"
import type { AvailableEmployee, SystemUser, UserRole } from "../../types/user"

type UserPanelProps = {
  user: SystemUser | null
  open: boolean
  isSuperAdmin: boolean
  currentUserId: string
  availableEmployees: AvailableEmployee[]
  onClose: () => void
  onCreate: (input: UserCreateInput) => Promise<void>
  onUpdate: (userId: string, input: UserUpdateInput) => Promise<void>
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function suggestPresetForEmployee(emp?: AvailableEmployee): string {
  if (!emp) return ""
  const dept = (emp.departmentName || "").toLowerCase()
  const job = (emp.jobTitle || "").toLowerCase()
  const isManagerLevel =
    job.includes("manager") ||
    job.includes("president") ||
    job.includes("supervisor") ||
    job.includes("director")

  if (dept.includes("sales")) {
    return isManagerLevel ? "sales-manager" : "sales-employee"
  }
  if (dept.includes("human") || dept.includes("hr")) {
    return isManagerLevel ? "hr-manager" : "hr-employee"
  }
  if (dept.includes("account") || dept.includes("finance") || dept.includes("executive")) {
    return isManagerLevel ? "accounting-manager" : "accounting-employee"
  }
  if (dept.includes("inventory") || dept.includes("warehouse") || dept.includes("product")) {
    return isManagerLevel ? "inventory-manager" : "inventory-employee"
  }
  return isManagerLevel ? "all-manager" : "all-employee"
}

export default function UserPanel({
  user,
  open,
  isSuperAdmin,
  currentUserId,
  availableEmployees,
  onClose,
  onCreate,
  onUpdate,
}: UserPanelProps) {
  const [selectedEmpno, setSelectedEmpno] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("employee")
  const [presetId, setPresetId] = useState("")
  const [password, setPassword] = useState("")
  const [mustChangePassword, setMustChangePassword] = useState(true)
  const [firstNameError, setFirstNameError] = useState("")
  const [lastNameError, setLastNameError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saving, setSaving] = useState(false)

  const isEditing = Boolean(user)
  const isEditingSelf = Boolean(user && String(user.userId) === String(currentUserId))

  useEffect(() => {
    if (!open) return

    setSelectedEmpno("")
    setFirstName(user?.firstName ?? "")
    setLastName(user?.lastName ?? "")
    setEmail(user?.email ?? "")
    setRole(user?.role ?? "employee")
    setPresetId("")
    setPassword("")
    setMustChangePassword(user ? Boolean(user.mustChangePassword) : true)
    setFirstNameError("")
    setLastNameError("")
    setEmailError("")
    setPasswordError("")
    setSaveError("")
  }, [open, user])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open, saving])

  const handleSelectEmployee = (empno: string) => {
    setSelectedEmpno(empno)
    const found = availableEmployees.find((emp) => emp.empno === empno)
    if (found) {
      setFirstName(found.firstName)
      setLastName(found.lastName)
      setEmail(found.email)
      setPresetId(suggestPresetForEmployee(found))
      setFirstNameError("")
      setLastNameError("")
      setEmailError("")
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    const trimmedEmail = email.trim().toLowerCase()

    const nextFirstError = !trimmedFirst
      ? "First name is required."
      : trimmedFirst.length > 15
        ? "First name must be 15 characters or fewer."
        : ""
    const nextLastError = !trimmedLast
      ? "Last name is required."
      : trimmedLast.length > 15
        ? "Last name must be 15 characters or fewer."
        : ""
    const nextEmailError = !trimmedEmail
      ? "Email is required."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
        ? "Enter a valid email address."
        : ""
    const nextPasswordError = !isEditing
      ? password.length < 8
        ? "Temporary password must be at least 8 characters."
        : ""
      : password && password.length < 8
        ? "New password must be at least 8 characters."
        : ""

    setFirstNameError(nextFirstError)
    setLastNameError(nextLastError)
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)

    if (nextFirstError || nextLastError || nextEmailError || nextPasswordError) {
      return
    }

    setSaving(true)
    setSaveError("")
    try {
      const selectedPreset = departmentPermissionPresets.find((p) => p.id === presetId)
      if (user) {
        await onUpdate(user.userId, {
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
          role,
          password: password || undefined,
          mustChangePassword: password ? mustChangePassword : undefined,
        })
      } else {
        await onCreate({
          empno: selectedEmpno || undefined,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
          role,
          password,
          mustChangePassword,
          rights: selectedPreset ? selectedPreset.rights : undefined,
        })
      }
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save user account.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        aria-label="Close user details"
        onClick={() => {
          if (!saving) onClose()
        }}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-panel-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.14)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-300 px-6 py-6 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Administration / User account
            </p>
            <h2
              id="user-panel-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              {isEditing ? "Edit User Account" : "Add User Account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isEditing
                ? "Update account details, system role, or reset the user’s password."
                : "Provision a login account for an employee and assign their system role."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!saving) onClose()
            }}
            aria-label="Close user details"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
            <div className="border-l-2 border-blue-800 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-900">
                Role hierarchy
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                {isSuperAdmin
                  ? "Superadmins can assign Superadmin, Admin, or Employee roles. Employee accounts use granular module rights."
                  : "Admins can provision and manage Employee accounts and their module rights."}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {!isEditing && availableEmployees.length > 0 && (
                <label className="block">
                  <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                    Link to Existing Employee
                    <span className="font-medium text-slate-400">Optional</span>
                  </span>
                  <select
                    value={selectedEmpno}
                    onChange={(event) => handleSelectEmployee(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  >
                    <option value="">Create new employee record automatically</option>
                    {availableEmployees.map((emp) => (
                      <option key={emp.empno} value={emp.empno}>
                        #{emp.empno} — {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {isEditing && (
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-700">Employee No</span>
                  <input
                    type="text"
                    readOnly
                    value={user?.empno ?? "—"}
                    className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 font-mono text-sm font-medium text-slate-500 outline-none"
                  />
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    First Name
                    <span className="font-medium text-slate-400">Required</span>
                  </span>
                  <input
                    type="text"
                    value={firstName}
                    maxLength={15}
                    onChange={(event) => {
                      setFirstName(event.target.value)
                      if (firstNameError) setFirstNameError("")
                    }}
                    placeholder="First name"
                    aria-invalid={Boolean(firstNameError)}
                    className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
                      firstNameError
                        ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                        : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                    }`}
                  />
                  {firstNameError && (
                    <p className="pt-1 text-xs font-semibold text-red-600">{firstNameError}</p>
                  )}
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    Last Name
                    <span className="font-medium text-slate-400">Required</span>
                  </span>
                  <input
                    type="text"
                    value={lastName}
                    maxLength={15}
                    onChange={(event) => {
                      setLastName(event.target.value)
                      if (lastNameError) setLastNameError("")
                    }}
                    placeholder="Last name"
                    aria-invalid={Boolean(lastNameError)}
                    className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
                      lastNameError
                        ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                        : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                    }`}
                  />
                  {lastNameError && (
                    <p className="pt-1 text-xs font-semibold text-red-600">{lastNameError}</p>
                  )}
                </label>
              </div>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                  Work Email
                  <span className="font-medium text-slate-400">Required</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (emailError) setEmailError("")
                  }}
                  placeholder="name@hope.inc"
                  aria-invalid={Boolean(emailError)}
                  className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
                    emailError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
                {emailError && (
                  <p className="pt-1 text-xs font-semibold text-red-600">{emailError}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                  Account Role
                  <span className="font-medium text-slate-400">
                    {isEditingSelf
                      ? "Cannot change your own role"
                      : isSuperAdmin
                        ? "Select role"
                        : "Employee only"}
                  </span>
                </span>
                <select
                  value={role}
                  disabled={!isSuperAdmin || isEditingSelf}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {isSuperAdmin && <option value="superadmin">Superadmin (System Owner)</option>}
                  {isSuperAdmin && <option value="admin">Admin (Manager)</option>}
                  <option value="employee">Employee (Granular Rights)</option>
                </select>
              </label>

              {!isEditing && role === "employee" && (
                <label className="block">
                  <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                    Department &amp; Role Permission Preset
                    <span className="font-medium text-slate-400">Pre-selected rights</span>
                  </span>
                  <select
                    aria-label="Department permission preset"
                    value={presetId}
                    onChange={(event) => setPresetId(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  >
                    <option value="">Default Employee (Read-Only Modules)</option>
                    {departmentPermissionPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
                  {isEditing ? "Reset Password" : "Temporary Password"}
                  <span className="font-medium text-slate-400">
                    {isEditing ? "Leave blank to keep current" : "Min. 8 characters"}
                  </span>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (passwordError) setPasswordError("")
                  }}
                  placeholder={isEditing ? "••••••••" : "Enter temporary password"}
                  aria-invalid={Boolean(passwordError)}
                  className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
                    passwordError
                      ? "border-red-500 shadow-[0_0_0_3px] shadow-red-50"
                      : "border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  }`}
                />
                {passwordError && (
                  <p className="pt-1 text-xs font-semibold text-red-600">{passwordError}</p>
                )}
              </label>

              {(!isEditing || password.length > 0) && (
                <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(event) => setMustChangePassword(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                  />
                  Require user to change password on next sign-in
                </label>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-300 bg-white px-6 py-4 sm:px-8">
            {saveError && (
              <p role="alert" className="mr-auto text-xs font-semibold text-red-700">
                {saveError}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:opacity-70"
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Create user"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
