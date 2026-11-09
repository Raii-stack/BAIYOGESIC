import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

import { authApi, AuthApiError, type AuthUser } from "../../lib/auth"
import { clearDashboardStats } from "../../lib/dashboard-api"
import { WorkspaceProvider } from "../common/WorkspaceProvider"

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorizationRevision, setAuthorizationRevision] = useState(0)
  const userRef = useRef(user)
  userRef.current = user
  const scopeKey = (value: AuthUser | null) => JSON.stringify([value?.role, value?.departmentCode, value?.rights, value?.authorizationVersion])

  useEffect(() => {
    clearDashboardStats()
    let active = true
    authApi.session()
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof AuthApiError && error.status === 401)) {
          // The login form remains available when the API is temporarily unavailable.
          console.error("Could not restore the session", error)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const expire = () => { clearDashboardStats(); setUser(null) }
    window.addEventListener("hope:session-expired", expire)
    return () => window.removeEventListener("hope:session-expired", expire)
  }, [])

  useEffect(() => {
    if (!user || user.mustChangePassword) return
    let lastActivity = Date.now()
    let lastSent = 0
    let pending = false
    let disposed = false
    const heartbeat = () => {
      if (document.visibilityState === "hidden" || Date.now() - lastActivity > 120000 || Date.now() - lastSent < 30000 || pending) return
      pending = true
      lastSent = Date.now()
      authApi.heartbeat(Date.now() - lastActivity).catch((error) => {
        if (!disposed && error instanceof AuthApiError && error.status === 401) { clearDashboardStats(); setUser(null) }
      }).finally(() => { pending = false })
    }
    const active = () => { lastActivity = Date.now() }
    const focus = () => { active(); heartbeat() }
    heartbeat()
    const timer = window.setInterval(heartbeat, 60000)
    window.addEventListener("pointermove", active, { passive: true })
    window.addEventListener("pointerdown", active, { passive: true })
    window.addEventListener("keydown", active)
    window.addEventListener("scroll", active, { passive: true })
    window.addEventListener("focus", focus)
    document.addEventListener("visibilitychange", focus)
    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener("pointermove", active)
      window.removeEventListener("pointerdown", active)
      window.removeEventListener("keydown", active)
      window.removeEventListener("scroll", active)
      window.removeEventListener("focus", focus)
      document.removeEventListener("visibilitychange", focus)
    }
  }, [user?.userId, user?.mustChangePassword])

  useEffect(() => {
    if (!user) return
    let disposed = false
    let pending = false
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return
      pending = true
      try {
        const { user: next } = await authApi.session()
        const current = userRef.current
        if (!disposed && current && next && String(current.userId) === String(next.userId) && JSON.stringify(current) !== JSON.stringify(next)) {
          if (scopeKey(current) !== scopeKey(next)) { clearDashboardStats(); setAuthorizationRevision(value => value + 1) }
          setUser(next)
        }
      } catch (error) {
        if (!disposed && error instanceof AuthApiError && error.status === 401) { clearDashboardStats(); setUser(null) }
      } finally { pending = false }
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    window.addEventListener("hope:authorization-changed", refresh)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("hope:authorization-changed", refresh) }
  }, [user?.userId])

  const login = async (email: string, password: string) => {
    const { user: signedInUser } = await authApi.login(email.trim().toLowerCase(), password)
    clearDashboardStats()
    setUser(signedInUser)
    return signedInUser
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword(currentPassword, newPassword)
    window.dispatchEvent(new Event("hope:notifications-changed"))
    setUser((current) => current ? { ...current, mustChangePassword: false } : current)
  }

  const refreshUser = async () => {
    const { user: next } = await authApi.session()
    setUser((current) => current && next && String(current.userId) === String(next.userId) ? next : current)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      if (!(error instanceof AuthApiError && error.status === 401)) throw error
    }
    clearDashboardStats()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout, refreshUser }}>
      <WorkspaceProvider key={authorizationRevision} user={user}>{children}</WorkspaceProvider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
