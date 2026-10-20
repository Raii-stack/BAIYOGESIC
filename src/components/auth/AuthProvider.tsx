import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { authApi, AuthApiError, type AuthUser } from "../../lib/auth"

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
    const expire = () => setUser(null)
    window.addEventListener("hope:session-expired", expire)
    return () => window.removeEventListener("hope:session-expired", expire)
  }, [])

  const login = async (email: string, password: string) => {
    const { user: signedInUser } = await authApi.login(email.trim().toLowerCase(), password)
    setUser(signedInUser)
    return signedInUser
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword(currentPassword, newPassword)
    setUser((current) => current ? { ...current, mustChangePassword: false } : current)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      if (!(error instanceof AuthApiError && error.status === 401)) throw error
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
