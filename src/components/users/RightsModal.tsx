import { useEffect, useState } from "react"

import { permissionGroups } from "../../lib/users"
import type { SystemUser } from "../../types/user"

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

export default function RightsModal({
  user,
  onClose,
  onSave,
}: {
  user: SystemUser | null
  onClose: () => void
  onSave: (userId: string, rights: string[]) => void
}) {
  const [selectedRights, setSelectedRights] = useState<string[]>([])

  useEffect(() => {
    setSelectedRights(user?.rights ?? [])

    if (!user) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, user])

  if (!user) return null

  const setModuleRights = (permissionIds: string[], selected: boolean) => {
    setSelectedRights((current) => {
      const withoutModule = current.filter(
        (right) => !permissionIds.includes(right),
      )
      return selected ? [...withoutModule, ...permissionIds] : withoutModule
    })
  }

  const toggleRight = (permissionId: string) => {
    setSelectedRights((current) =>
      current.includes(permissionId)
        ? current.filter((right) => right !== permissionId)
        : [...current, permissionId],
    )
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4 py-6">
      <button
        type="button"
        aria-label="Close rights assignment"
        onClick={onClose}
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
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rights assignment"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="border-l-2 border-blue-800 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold leading-5 text-blue-900">
              Assign only the permissions required for this user’s
              responsibilities. Changes apply to their next authorized request.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {permissionGroups.map((group) => {
              const permissionIds = group.permissions.map(
                (permission) => permission.id,
              )
              const selectedCount = permissionIds.filter((permissionId) =>
                selectedRights.includes(permissionId),
              ).length

              return (
                <section
                  key={group.module}
                  aria-labelledby={`rights-${group.module.replaceAll(" ", "-")}`}
                  className="border border-slate-300"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-300 bg-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
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
                      <button
                        type="button"
                        onClick={() => setModuleRights(permissionIds, true)}
                        className="text-xs font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                      >
                        All
                      </button>
                      <span className="text-slate-300">/</span>
                      <button
                        type="button"
                        onClick={() => setModuleRights(permissionIds, false)}
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
                          onClick={() => toggleRight(permission.id)}
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
            {selectedRights.length} permissions selected
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-3 text-sm font-bold text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(user.id, selectedRights)
                onClose()
              }}
              className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              Save Rights
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
