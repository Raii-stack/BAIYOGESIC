import { useEffect, useState } from "react"

import { departmentPermissionPresets, permissionGroups } from "../../lib/users"
import type { PermissionGroup, SystemUser } from "../../types/user"

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

export default function RightsModal({
  user,
  onClose,
  onSave,
}: {
  user: SystemUser | null
  onClose: () => void
  onSave: (userId: string, rights: string[]) => Promise<void>
}) {
  const [selectedRights, setSelectedRights] = useState<string[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setSelectedRights(user?.rights ?? [])
    setSelectedPresetId("")
    setSaving(false)
    setError("")

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

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      await onSave(user.userId, selectedRights)
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
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-300 border-t-[3px] border-t-blue-800 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-300 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Role-based access control
            </p>
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
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="grid gap-4 rounded-lg border border-slate-300 bg-slate-50 p-4 sm:grid-cols-[minmax(260px,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-800">
                Pre-selected Department &amp; Role Configuration
              </span>
              <select
                aria-label="Permission preset configuration"
                value={selectedPresetId}
                onChange={(event) => applyDepartmentPreset(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select a department / role preset…</option>
                <optgroup label="Sales & CRM Department">
                  <option value="sales-manager">Sales &amp; CRM — Manager</option>
                  <option value="sales-employee">Sales &amp; CRM — Employee</option>
                </optgroup>
                <optgroup label="Inventory & Products Department">
                  <option value="inventory-manager">Inventory &amp; Products — Manager</option>
                  <option value="inventory-employee">Inventory &amp; Products — Employee</option>
                </optgroup>
                <optgroup label="Human Resources Department">
                  <option value="hr-manager">Human Resources — Manager</option>
                  <option value="hr-employee">Human Resources — Employee</option>
                </optgroup>
                <optgroup label="Accounting & Finance Department">
                  <option value="accounting-manager">Accounting &amp; Finance — Manager</option>
                  <option value="accounting-employee">Accounting &amp; Finance — Employee</option>
                </optgroup>
                <optgroup label="All Departments">
                  <option value="all-manager">All Departments — Manager (Full Access)</option>
                  <option value="all-employee">All Departments — Employee (Read-Only)</option>
                </optgroup>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyDepartmentPreset("all-manager")}
                className="h-10 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-bold text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Grant All
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPresetId("")
                  setSelectedRights([])
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
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

          <div className="mt-4 border-l-2 border-blue-800 bg-blue-50 px-4 py-3">
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
                  className="overflow-hidden rounded-md border border-slate-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 bg-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={moduleEnabled}
                        onChange={() => toggleModuleAccess(group)}
                        aria-label={`Enable ${group.module} module`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700"
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
                    <div className="flex items-center gap-3">
                      <select
                        aria-label={`${group.module} role preset`}
                        value={modulePreset}
                        onChange={(event) => applyModulePreset(group, event.target.value)}
                        className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700"
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
                        className="text-xs font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                      >
                        All
                      </button>
                      <span className="text-slate-300">/</span>
                      <button
                        type="button"
                        onClick={() => setModuleRights(group, false)}
                        className="text-xs font-bold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
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
                          key={permission.id}
                          className={`flex items-center gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700 ${
                            selected ? "text-slate-950" : "text-slate-600"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`relative h-5 w-9 shrink-0 rounded-full border transition ${
                              selected
                                ? "border-blue-800 bg-blue-800"
                                : "border-slate-300 bg-slate-200"
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

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:px-8">
          <p className="hidden text-xs text-slate-500 sm:block">
            {actionRightsCount} action permissions selected
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 px-3 text-sm font-bold text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Rights"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
