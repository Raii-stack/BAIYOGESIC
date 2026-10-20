import type { ReactNode } from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router"

import { AuthProvider, useAuth } from "./components/auth/AuthProvider"
import ToastHost from "./components/common/ToastHost"
import { isSuperAdminRole } from "./lib/auth"
import { canAccessModule, hasRight, type ErpModuleKey } from "./lib/rbac"

import DashboardPage from "./components/pages/DashboardPage"
import LoginPage from "./components/pages/LoginPage"
import ResetPasswordPage from "./components/pages/ResetPasswordPage"
import CustomerManagementPage from "./pages/CustomerManagementPage"
import CreateSalePage from "./pages/CreateSalePage"
import EmployeeDirectoryPage from "./pages/EmployeeDirectoryPage"
import EmployeeProfilePage from "./pages/EmployeeProfilePage"
import InventoryPage from "./pages/InventoryPage"
import ReportsPage from "./pages/ReportsPage"
import SalesManagementPage from "./pages/SalesManagementPage"
import UserManagementPage from "./pages/UserManagementPage"

function matchesAllowedRoles(userRole: string, allowedRoles: string[]): boolean {
  if (allowedRoles.includes(userRole)) return true
  if (isSuperAdminRole(userRole) && (allowedRoles.includes("superadmin") || allowedRoles.includes("administrator"))) {
    return true
  }
  return false
}

export function ProtectedPage({
  children,
  roles,
  module,
  right,
}: {
  children: ReactNode
  roles?: string[]
  module?: ErpModuleKey
  right?: string
}) {
  const { user, loading } = useAuth()
  if (loading) return <div role="status" className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600">Checking your session…</div>
  if (!user || user.status !== "active" || user.isBlocked || user.mustChangePassword) return <Navigate to="/" replace />
  if (roles && !matchesAllowedRoles(user.role, roles)) return <Navigate to="/dashboard" replace />
  if (module && !canAccessModule(user, module)) return <Navigate to="/dashboard" replace />
  if (right && !hasRight(user, right)) return <Navigate to="/dashboard" replace />
  return children
}

const protectedPage = (
  page: ReactNode,
  options?: { roles?: string[]; module?: ErpModuleKey; right?: string },
) => (
  <ProtectedPage roles={options?.roles} module={options?.module} right={options?.right}>
    {page}
  </ProtectedPage>
)

const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/create-account", element: <Navigate to="/" replace /> },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/dashboard", element: protectedPage(<DashboardPage />) },
  { path: "/customers", element: protectedPage(<CustomerManagementPage />, { module: "customers" }) },
  { path: "/inventory", element: protectedPage(<InventoryPage />, { module: "products" }) },
  { path: "/reports", element: protectedPage(<ReportsPage />, { module: "reports" }) },
  { path: "/employees", element: protectedPage(<EmployeeDirectoryPage />, { module: "hr" }) },
  { path: "/employees/:employeeId", element: protectedPage(<EmployeeProfilePage />, { module: "hr" }) },
  { path: "/sales/new", element: protectedPage(<CreateSalePage />, { module: "sales", right: "sales.add" }) },
  { path: "/sales", element: protectedPage(<SalesManagementPage />, { module: "sales" }) },
  { path: "/users", element: protectedPage(<UserManagementPage />, { roles: ["superadmin", "administrator", "admin"], module: "users" }) },
  { path: "*", Component: LoginPage },
])

export default function App() {
  return <AuthProvider><ToastHost /><RouterProvider router={router} /></AuthProvider>
}
