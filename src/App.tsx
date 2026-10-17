import { createBrowserRouter, Navigate, RouterProvider } from "react-router"
import type { ComponentType } from "react"

import CreateAccountPage from "./components/pages/CreateAccountPage"
import DashboardPage from "./components/pages/DashboardPage"
import LoginPage from "./components/pages/LoginPage"
import ResetPasswordPage from "./components/pages/ResetPasswordPage"
import CustomerManagementPage from "./pages/CustomerManagementPage"
import CreateSalePage from "./pages/CreateSalePage"
import EmployeeDirectoryPage from "./pages/EmployeeDirectoryPage"
import EmployeeProfilePage from "./pages/EmployeeProfilePage"
import InventoryPage from "./pages/InventoryPage"
import ProfilePage from "./pages/ProfilePage"
import { getCurrentUser } from "./lib/auth"

function ProtectedPage({ page: Page }: { page: ComponentType }) {
  return getCurrentUser() ? <Page /> : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/create-account", Component: () => <ProtectedPage page={CreateAccountPage} /> },
  { path: "/reset-password", Component: () => <ProtectedPage page={ResetPasswordPage} /> },
  { path: "/dashboard", Component: () => <ProtectedPage page={DashboardPage} /> },
  { path: "/customers", Component: () => <ProtectedPage page={CustomerManagementPage} /> },
  { path: "/inventory", Component: () => <ProtectedPage page={InventoryPage} /> },
  { path: "/employees", Component: () => <ProtectedPage page={EmployeeDirectoryPage} /> },
  { path: "/employees/:employeeId", Component: () => <ProtectedPage page={EmployeeProfilePage} /> },
  { path: "/sales/new", Component: () => <ProtectedPage page={CreateSalePage} /> },
  { path: "/profile", Component: () => <ProtectedPage page={ProfilePage} /> },
  { path: "*", Component: LoginPage },
])

export default function App() {
  return <RouterProvider router={router} />
}
