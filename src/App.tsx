import { createBrowserRouter, RouterProvider } from "react-router"

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

const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/create-account", Component: CreateAccountPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/dashboard", Component: DashboardPage },
  { path: "/customers", Component: CustomerManagementPage },
  { path: "/inventory", Component: InventoryPage },
  { path: "/employees", Component: EmployeeDirectoryPage },
  { path: "/employees/:employeeId", Component: EmployeeProfilePage },
  { path: "/sales/new", Component: CreateSalePage },
  { path: "/profile", Component: ProfilePage },
  { path: "*", Component: LoginPage },
])

export default function App() {
  return <RouterProvider router={router} />
}
