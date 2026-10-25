import { useEffect, useState } from "react"

import { departmentPermissionPresets, permissionGroups } from "../../lib/users"
import type { PermissionGroup, SystemUser, UserRole } from "../../types/user"

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

function getModulePresetValue(group: PermissionGroup, selectedRights: string[]): string {
  const actionIds = group.permissions.map((p) => p.id)
  const allModuleCodes = [group.accessRight, ...actionIds]
  const currentInModule = allModuleCodes.filter((code) => selectedRights.includes(code))

  if (currentInModule.length === 0) return "none"
  if (allModuleCodes.every((code) => selectedRights.includes(code))) return "manager"

  const matchesSet = (target: string[]) =>
    currentInModule.length === target.length &&
    target.every((code) => currentInModule.includes(code))

  if (matchesSet(group.employeeDefaultIds)) return "employee"
  if (matchesSet(group.viewerIds)) return "viewer"
  return "custom"
}

function getDepartmentPresetId(rights: string[]): string {
  const selected = new Set(rights)
  return departmentPermissionPresets.find(
    (preset) =>
      preset.rights.length === selected.size &&
      preset.rights.every((right) => selected.has(right)),
  )?.id ?? ""
}

export default function RightsModal({
  user,
  canAssignAdmin,
  onClose,
  onSave,
}: {
  user: SystemUser | null
  canAssignAdmin: boolean
  onClose: () => void
  onSave: (userId: string, rights: string[], role: UserRole) => Promise<void>
}) {
  const [selectedRights, setSelectedRights] = useState<string[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const rights = user?.rights ?? []
    setSelectedRights(rights)
    setSelectedPresetId(getDepartmentPresetId(rights))
    setSaving(false)
    setError("")
  }, [user])

  useEffect(() => {
    if (!user) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, saving, user])

  if (!user) return null

  const applyDepartmentPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = departmentPermissionPresets.find((item) => item.id === presetId)
    if (!preset) return
    setSelectedRights([...preset.rights])
  }

  const applyModulePreset = (group: PermissionGroup, presetMode: string) => {
    const actionIds = group.permissions.map((p) => p.id)
    const allModuleCodes = [group.accessRight, ...actionIds]
    setSelectedPresetId("")
    setSelectedRights((current) => {
      const withoutModule = current.filter((code) => !allModuleCodes.includes(code))
      if (presetMode === "manager") {
        return [...withoutModule, ...allModuleCodes]
      }
      if (presetMode === "employee") {
        return [...withoutModule, ...group.employeeDefaultIds]
      }
      if (presetMode === "viewer") {
        return [...withoutModule, ...group.viewerIds]
      }
      return withoutModule
    })
  }

  const toggleModuleAccess = (group: PermissionGroup) => {
    const actionIds = group.permissions.map((p) => p.id)
    const allModuleCodes = [group.accessRight, ...actionIds]
    const isEnabled =
      selectedRights.includes(group.accessRight) ||
      actionIds.some((id) => selectedRights.includes(id))

    setSelectedPresetId("")
    setSelectedRights((current) => {
      const withoutModule = current.filter((code) => !allModuleCodes.includes(code))
      return isEnabled ? withoutModule : [...withoutModule, group.accessRight]
    })
  }

  const setModuleRights = (group: PermissionGroup, selected: boolean) => {
    const actionIds = group.permissions.map((p) => p.id)
    const allModuleCodes = [group.accessRight, ...actionIds]
    setSelectedPresetId("")
    setSelectedRights((current) => {
      const withoutModule = current.filter((right) => !allModuleCodes.includes(right))
      return selected ? [...withoutModule, ...allModuleCodes] : withoutModule
    })
  }

  const toggleRight = (group: PermissionGroup, permissionId: string) => {
    setSelectedPresetId("")
    setSelectedRights((current) => {
      if (current.includes(permissionId)) {
        return current.filter((right) => right !== permissionId)
      }
      const next = [...current, permissionId]
      if (!next.includes(group.accessRight)) {
        next.push(group.accessRight)
      }
      return next
    })
  }

  const actionRightsCount = permissionGroups
    .flatMap((group) => group.permissions.map((p) => p.id))
    .filter((id) => selectedRights.includes(id)).length

  const activePreset = departmentPermissionPresets.find(
    (item) => item.id === selectedPresetId,
  )
  const matchedPreset = departmentPermissionPresets.find(
    (item) => item.id === getDepartmentPresetId(selectedRights),
  )
  const nextRole: UserRole =
    user.role === "superadmin"
      ? "superadmin"
      : canAssignAdmin && matchedPreset?.level === "Manager"
        ? "admin"
        : "employee"

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError("")
    try {
      await onSave(user.userId, selectedRights, nextRole)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save user rights.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4 py-6">
      <button
        type="button"
        aria-label="Close rights assignment"
        onClick={() => {
          if (!saving) onClose()
        }}
        className="absolute inset-0 bg-slate-950/70"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rights-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden workspace-panel shadow-xl"
      >
        <header className="workspace-drawer-header">
          <div>
            <h2
              id="rights-modal-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
            >
              Rights — {user.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {user.email}
              {user.empno ? ` · Emp #${user.empno}` : ""}
              {user.jobTitle || user.departmentName
                ? ` · ${[user.jobTitle, user.departmentName].filter(Boolean).join(" — ")}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close rights assignment"
            className="workspace-icon-action"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="workspace-drawer-body">
          <div className="grid gap-4 rounded-lg border border-neutral-200 bg-slate-50 p-4 sm:grid-cols-[minmax(260px,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="workspace-label">
                Pre-selected Department &amp; Role Configuration
              </span>
              <select
                aria-label="Permission preset configuration"
                value={selectedPresetId}
                onChange={(event) => applyDepartmentPreset(event.target.value)}
                disabled={saving}
                className="workspace-control"
              >
                <option value="">Select a department / role preset…</option>
                <optgroup label="Sales & CRM Department">
                  <option value="sales-manager" disabled={!canAssignAdmin}>Sales &amp; CRM — Manager</option>
                  <option value="sales-employee">Sales &amp; CRM — Employee</option>
                </optgroup>
                <optgroup label="Inventory & Products Department">
                  <option value="inventory-manager" disabled={!canAssignAdmin}>Inventory &amp; Products — Manager</option>
                  <option value="inventory-employee">Inventory &amp; Products — Employee</option>
                </optgroup>
                <optgroup label="Human Resources Department">
                  <option value="hr-manager" disabled={!canAssignAdmin}>Human Resources — Manager</option>
                  <option value="hr-employee">Human Resources — Employee</option>
                </optgroup>
                <optgroup label="Accounting & Finance Department">
                  <option value="accounting-manager" disabled={!canAssignAdmin}>Accounting &amp; Finance — Manager</option>
                  <option value="accounting-employee">Accounting &amp; Finance — Employee</option>
                </optgroup>
                <optgroup label="All Departments">
                  <option value="all-manager" disabled={!canAssignAdmin}>All Departments — Manager (Full Access)</option>
                  <option value="all-employee">All Departments — Employee (Read-Only)</option>
                </optgroup>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyDepartmentPreset("all-manager")}
                disabled={saving || !canAssignAdmin}
                className="workspace-secondary-action"
              >
                Grant All
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPresetId("")
                  setSelectedRights([])
                }}
                disabled={saving}
                className="workspace-secondary-action"
              >
                Clear All
              </button>
            </div>
            {activePreset && (
              <p className="text-xs leading-5 text-blue-900 sm:col-span-2">
                <strong className="font-bold">{activePreset.label}:</strong>{" "}
                {activePreset.description}
              </p>
            )}
          </div>

          <div className="workspace-notice mt-4">
            <p className="text-xs font-semibold leading-5 text-blue-900">
              Ticking a module switch enables module access; the switches inside each
              group grant specific Add, Edit, Delete, or Report actions. You can also
              use each module’s preset selector to configure Manager or Employee rights
              per department.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800"
            >
              {error}
            </div>
          )}

          <div className="mt-5 space-y-4">
            {permissionGroups.map((group) => {
              const permissionIds = group.permissions.map((permission) => permission.id)
              const selectedCount = permissionIds.filter((permissionId) =>
                selectedRights.includes(permissionId),
              ).length
              const moduleEnabled =
                selectedRights.includes(group.accessRight) || selectedCount > 0
              const modulePreset = getModulePresetValue(group, selectedRights)

              return (
                <section
                  key={group.module}
                  aria-labelledby={`rights-${group.module.replaceAll(" ", "-")}`}
                  className="overflow-hidden rounded-md border border-neutral-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={moduleEnabled}
                        onChange={() => toggleModuleAccess(group)}
                        disabled={saving}
                        aria-label={`Enable ${group.module} module`}
                        className="h-4 w-4 rounded border-neutral-300 accent-neutral-800 focus:ring-blue-700"
                      />
                      <h3
                        id={`rights-${group.module.replaceAll(" ", "-")}`}
                        className="text-sm font-bold text-slate-900"
                      >
                        {group.module}
                      </h3>
                      <span className="font-mono text-[10px] text-slate-500">
                        {selectedCount}/{permissionIds.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        aria-label={`${group.module} role preset`}
                        value={modulePreset}
                        onChange={(event) => applyModulePreset(group, event.target.value)}
                        disabled={saving}
                        className="workspace-control"
                      >
                        <option value="manager">Manager (Full)</option>
                        <option value="employee">Employee (Standard)</option>
                        <option value="viewer">Viewer (Read-Only)</option>
                        <option value="none">No Access</option>
                        {modulePreset === "custom" && (
                          <option value="custom">Custom Selection</option>
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => setModuleRights(group, true)}
                        disabled={saving}
                        className="workspace-text-action"
                      >
                        All
                      </button>
                      <span className="text-slate-300">/</span>
                      <button
                        type="button"
                        onClick={() => setModuleRights(group, false)}
                        disabled={saving}
                        className="workspace-text-action"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
                    {group.permissions.map((permission) => {
                      const selected = selectedRights.includes(permission.id)

                      return (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selected}
                          onClick={() => toggleRight(group, permission.id)}
                          disabled={saving}
                          key={permission.id}
                          className={`flex items-center gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700 ${
                            selected ? "text-slate-950" : "text-slate-600"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`relative h-5 w-9 shrink-0 rounded-full border transition ${
                              selected
                                ? "border-neutral-800 bg-neutral-800"
                                : "border-neutral-200 bg-slate-200"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                                selected
                                  ? "translate-x-[18px]"
                                  : "translate-x-0.5"
                              }`}
                            />
                          </span>
                          <span className="text-xs font-semibold">
                            {permission.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>

        <footer className="workspace-drawer-footer">
          <p className="hidden text-xs text-slate-500 sm:block">
            {actionRightsCount} action permissions selected · Role after save: {
              nextRole === "superadmin" ? "Superadmin" : nextRole === "admin" ? "Admin" : "Employee"
            }
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="workspace-secondary-action"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="workspace-primary-action"
            >
              {saving ? "Saving…" : "Save Rights"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
