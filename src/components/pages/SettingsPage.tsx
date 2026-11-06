import { useEffect, useRef, useState, type FormEvent } from "react"
import DashboardLayout from "../../layouts/DashboardLayout"
import { useWorkspace } from "../common/WorkspaceProvider"
import ChangePasswordModal from "../auth/ChangePasswordModal"
import { notifyToast } from "../../lib/toast"
import type { Preferences } from "../../lib/workspace-api"

const options: { key: Exclude<keyof Preferences, "density">; label: string; description: string }[] = [
  { key: "motion", label: "Smooth animations", description: "Subtle transitions for menus, dialogs, and expanded details. Your device’s reduced-motion preference always takes priority." },
  { key: "popups", label: "Notification popups", description: "Show a quiet popup when new inbox notifications arrive." },
  { key: "employment", label: "Employment updates", description: "Changes to your employee record and job history." },
  { key: "sales", label: "Sales activity", description: "New, archived, and restored sales relevant to you." },
  { key: "payments", label: "Payment activity", description: "Recorded, changed, or removed payments relevant to you." },
  { key: "products", label: "Product and price changes", description: "Product archive/restore and price changes, including their effective dates." },
]

export default function SettingsPage() {
  const { preferences, preferencesDirty: dirty, setPreferences, preferencesError, preferencesLoaded, savePreferences } = useWorkspace()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [passwordOpen, setPasswordOpen] = useState(false)
  const passwordButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") === "security") document.getElementById("security")?.scrollIntoView({ block: "start" })
  }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("")
    try { await savePreferences(preferences); notifyToast("Settings saved to your account.") }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save settings.") }
    finally { setSaving(false) }
  }
  const update = (next: Preferences) => { setPreferences(next); setError("") }
  const closePassword = () => { setPasswordOpen(false); passwordButton.current?.focus() }
  return (
    <DashboardLayout activeNavigation="Settings">
      <main className="workspace-page"><div className="mx-auto max-w-3xl">
        <header className="workspace-page-header"><div><h1 className="workspace-page-title">Settings</h1><p className="workspace-page-description">Personal preferences saved to your account across devices.</p></div></header>
        {preferencesError && <div role="alert" className="mb-4 text-sm text-red-700">{preferencesError} <button type="button" onClick={() => window.dispatchEvent(new Event("hope:preferences-retry"))} className="underline">Retry loading settings</button></div>}
        {!preferencesLoaded && !preferencesError && <p role="status" className="mb-4 text-sm text-neutral-500">Loading your preferences…</p>}
        <form onSubmit={submit}>
          <fieldset disabled={!preferencesLoaded || saving} className="workspace-panel divide-y divide-neutral-100 disabled:opacity-60">
            <legend className="sr-only">Personal preferences</legend>
            <label className="flex flex-wrap items-center justify-between gap-3 p-5"><span><span className="block text-sm font-semibold">Table spacing</span><span className="mt-1 block text-xs text-neutral-500">Compact spacing applies to larger screens. Mobile controls remain easy to tap.</span></span>
              <select className="workspace-control w-auto" value={preferences.density} onChange={(event) => update({ ...preferences, density: event.target.value as Preferences["density"] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>
            </label>
            {options.map((option) => <label key={option.key} className="flex items-start justify-between gap-5 p-5"><span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{option.description}</span></span><input className="mt-1 shrink-0" type="checkbox" checked={preferences[option.key]} onChange={(event) => update({ ...preferences, [option.key]: event.target.checked })} /></label>)}
          </fieldset>
          <p className="mt-3 text-xs leading-5 text-neutral-500">Account and security notices always remain in your inbox. Your own business actions won’t create duplicate alerts.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} Your choices are kept; try saving again.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3"><button className="workspace-primary-action" disabled={!dirty || saving || !preferencesLoaded}>{saving ? "Saving…" : error ? "Retry saving settings" : "Save settings"}</button><span role="status" className="text-xs text-neutral-500">{dirty ? "Unsaved changes" : preferencesLoaded ? "Saved preferences" : ""}</span></div>
        </form>
        <section id="security" aria-labelledby="security-heading" className="workspace-panel mt-7 scroll-mt-24 p-5"><h2 id="security-heading" className="text-sm font-semibold">Account security</h2><p className="mt-2 text-[13px] text-neutral-500">Use your current password to choose a new one.</p><button ref={passwordButton} type="button" className="workspace-secondary-action mt-4" onClick={() => setPasswordOpen(true)}>Change password</button></section>
      </div></main>
      {passwordOpen && <ChangePasswordModal onClose={closePassword} />}
    </DashboardLayout>
  )
}
