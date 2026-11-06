import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { AuthUser } from "../../lib/auth"
import { defaultPreferences, emptyInbox, workspaceApi, type Preferences } from "../../lib/workspace-api"
import { notifyToast } from "../../lib/toast"

function useWorkspaceState(user: AuthUser | null) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [savedPreferences, setSavedPreferences] = useState<Preferences>(defaultPreferences)
  const [ownerId, setOwnerId] = useState("")
  const [preferencesError, setPreferencesError] = useState("")
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [inbox, setInbox] = useState(emptyInbox)
  const [inboxError, setInboxError] = useState("")
  const session = useRef(0)
  const refreshInbox = useRef<() => Promise<void>>(async () => {})
  const preferenceRef = useRef(preferences)
  preferenceRef.current = preferences

  useEffect(() => {
    const controller = new AbortController()
    const generation = ++session.current
    setOwnerId(String(user?.userId ?? ""))
    setPreferences(defaultPreferences); setSavedPreferences(defaultPreferences); setPreferencesLoaded(false); setPreferencesError("")
    setInbox(emptyInbox); setInboxError("")
    if (!user || user.mustChangePassword) return () => controller.abort()
    let loadedPreferences = false
    const loadPreferences = async () => {
      try {
        const result = await workspaceApi.preferences(controller.signal)
        if (!controller.signal.aborted && generation === session.current) { loadedPreferences = true; setPreferences(result); setSavedPreferences(result); setPreferencesLoaded(true); setPreferencesError("") }
      } catch (error) {
        if (!controller.signal.aborted) setPreferencesError(error instanceof Error ? error.message : "Unable to load preferences.")
      }
    }
    let pending = false
    let refreshRequested = false
    let checkedAt = 0
    let latest: bigint | null = null
    const load = async (force = false) => {
      if (pending) { if (force) refreshRequested = true; return }
      if (controller.signal.aborted || document.visibilityState === "hidden" || (!force && Date.now() - checkedAt < 30000)) return
      pending = true
      try {
        const result = await workspaceApi.inbox(1, controller.signal)
        if (controller.signal.aborted || generation !== session.current) return
        const highest = result.items.reduce((max, item) => /^\d+$/.test(item.id) && BigInt(item.id) > max ? BigInt(item.id) : max, 0n)
        if (loadedPreferences && latest !== null && highest > latest && preferenceRef.current.popups && result.items.some((item) => /^\d+$/.test(item.id) && BigInt(item.id) > latest! && !item.readAt)) notifyToast("You have new notifications.", "info")
        latest = highest > (latest ?? 0n) ? highest : latest ?? highest
        checkedAt = Date.now()
        setInbox((current) => JSON.stringify(current) === JSON.stringify(result) ? current : result)
        setInboxError("")
      } catch (error) {
        if (!controller.signal.aborted) setInboxError(error instanceof Error ? error.message : "Unable to load notifications.")
      } finally {
        pending = false
        if (refreshRequested && !controller.signal.aborted) { refreshRequested = false; void load(true) }
      }
    }
    refreshInbox.current = () => load(true)
    void loadPreferences(); void load()
    const visible = () => { void load(); if (!loadedPreferences) void loadPreferences() }
    const changed = () => void load(true)
    const retryPreferences = () => void loadPreferences()
    const timer = window.setInterval(() => void load(), 30000)
    window.addEventListener("focus", visible)
    document.addEventListener("visibilitychange", visible)
    window.addEventListener("hope:notifications-changed", changed)
    window.addEventListener("hope:preferences-retry", retryPreferences)
    return () => {
      controller.abort(); window.clearInterval(timer); refreshInbox.current = async () => {}
      window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible)
      window.removeEventListener("hope:notifications-changed", changed); window.removeEventListener("hope:preferences-retry", retryPreferences)
    }
  }, [user?.userId, user?.mustChangePassword])

  useEffect(() => {
    if (!user || ownerId !== String(user.userId)) return
    document.documentElement.dataset.workspaceMotion = preferences.motion ? "on" : "off"
    document.documentElement.dataset.workspaceDensity = preferences.density
    if (!preferences.motion) window.dispatchEvent(new Event("hope:motion-change"))
    return () => { delete document.documentElement.dataset.workspaceMotion; delete document.documentElement.dataset.workspaceDensity }
  }, [preferences.motion, preferences.density, user?.userId, ownerId])

  const savePreferences = useCallback(async (next: Preferences) => {
    const generation = session.current
    const result = await workspaceApi.savePreferences(next)
    if (generation === session.current) {
      if (JSON.stringify(preferenceRef.current) === JSON.stringify(next)) setPreferences(result)
      setSavedPreferences(result); setPreferencesLoaded(true); setPreferencesError("")
    }
  }, [])
  const refresh = useCallback(() => refreshInbox.current(), [])
  const read = useCallback(async (id?: string) => {
    const generation = session.current
    if (id) await workspaceApi.read(id); else await workspaceApi.readAll()
    if (generation === session.current) await refreshInbox.current()
  }, [])
  const ownsState = ownerId === String(user?.userId ?? "")
  return { preferences: ownsState ? preferences : defaultPreferences, preferencesDirty: ownsState && JSON.stringify(preferences) !== JSON.stringify(savedPreferences), setPreferences,
    preferencesError: ownsState ? preferencesError : "", preferencesLoaded: ownsState && preferencesLoaded, savePreferences,
    inbox: ownsState ? inbox : emptyInbox, inboxError: ownsState ? inboxError : "", refreshInbox: refresh, read }
}

type WorkspaceState = ReturnType<typeof useWorkspaceState>
const WorkspaceContext = createContext<WorkspaceState | null>(null)
export function WorkspaceProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  const state = useWorkspaceState(user)
  return <WorkspaceContext.Provider value={state}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("WorkspaceProvider is required")
  return value
}
