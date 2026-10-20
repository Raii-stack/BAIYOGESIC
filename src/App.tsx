import type { ReactNode } from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router"

import { AuthProvider, useAuth } from "./components/auth/AuthProvider"
import ToastHost from "./components/common/ToastHost"

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

export function ProtectedPage({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div role="status" className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600">Checking your session…</div>
  if (!user || user.status !== "active" || user.mustChangePassword) return <Navigate to="/" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

const protectedPage = (page: ReactNode, roles?: string[]) => <ProtectedPage roles={roles}>{page}</ProtectedPage>

const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/create-account", element: <Navigate to="/" replace /> },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/dashboard", element: protectedPage(<DashboardPage />) },
  { path: "/customers", element: protectedPage(<CustomerManagementPage />) },
  { path: "/inventory", element: protectedPage(<InventoryPage />) },
  { path: "/reports", element: protectedPage(<ReportsPage />) },
  { path: "/employees", element: protectedPage(<EmployeeDirectoryPage />) },
  { path: "/employees/:employeeId", element: protectedPage(<EmployeeProfilePage />) },
  { path: "/sales/new", element: protectedPage(<CreateSalePage />) },
  { path: "/sales", element: protectedPage(<SalesManagementPage />) },
  { path: "/users", element: protectedPage(<UserManagementPage />, ["administrator", "admin"]) },
  { path: "*", Component: LoginPage },
])

export default function App() {
  return <AuthProvider><ToastHost /><RouterProvider router={router} /></AuthProvider>
}
