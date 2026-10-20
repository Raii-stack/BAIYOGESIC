import type { PermissionGroup, SystemUser } from "../types/user"

export const systemUsers: SystemUser[] = [
  {
    id: "USR-001",
    name: "Superadmin Account",
    email: "superadmin@hope.example",
    role: "SUPERADMIN",
    status: "Active",
    rights: [],
  },
  {
    id: "USR-005",
    name: "System Administrator",
    email: "admin@hope.example",
    role: "ADMIN",
    status: "Active",
    rights: [],
  },
  {
    id: "USR-002",
    name: "Alex Rivera",
    email: "alex.rivera@hope.example",
    role: "USER",
    status: "Blocked",
    rights: [
      "customers.add",
      "products.add",
      "sales.add",
      "sales.details.view",
    ],
  },
  {
    id: "USR-003",
    name: "User Account 03",
    email: "user03@hope.example",
    role: "USER",
    status: "Active",
    rights: [
      "customers.edit",
      "products.edit",
      "sales.add",
      "sales.details.view",
      "reports.top-customers",
    ],
  },
  {
    id: "USR-004",
    name: "User Account 04",
    email: "user04@hope.example",
    role: "USER",
    status: "Active",
    rights: [
      "hr.employee.add",
      "hr.employee.edit",
      "hr.history.view",
      "reports.active-employees",
      "reports.all-employees",
    ],
  },
]

export const permissionGroups: PermissionGroup[] = [
  {
    module: "Customer Management",
    permissions: [
      { id: "customers.add", label: "Add Customer" },
      { id: "customers.edit", label: "Edit Customer" },
      { id: "customers.delete", label: "Delete Customer" },
    ],
  },
  {
    module: "Product Management",
    permissions: [
      { id: "products.add", label: "Add Product" },
      { id: "products.edit", label: "Edit Product" },
      { id: "products.delete", label: "Delete Product" },
      { id: "products.price.add", label: "Add Price" },
      { id: "products.price.edit", label: "Edit Price" },
      { id: "products.price.delete", label: "Delete Price" },
    ],
  },
  {
    module: "Human Resources",
    permissions: [
      { id: "hr.job.add", label: "Add Job" },
      { id: "hr.job.edit", label: "Edit Job" },
      { id: "hr.job.delete", label: "Delete Job" },
      { id: "hr.department.add", label: "Add Department" },
      { id: "hr.department.edit", label: "Edit Department" },
      { id: "hr.department.delete", label: "Delete Department" },
      { id: "hr.employee.add", label: "Add Employee" },
      { id: "hr.employee.edit", label: "Edit Employee" },
      { id: "hr.employee.delete", label: "Delete Employee" },
      { id: "hr.history.view", label: "View Job History" },
      { id: "hr.history.add", label: "Add Job History" },
      { id: "hr.history.edit", label: "Edit Job History" },
      { id: "hr.history.delete", label: "Delete Job History" },
    ],
  },
  {
    module: "Sales",
    permissions: [
      { id: "sales.add", label: "Add Sale" },
      { id: "sales.edit", label: "Edit Sale" },
      { id: "sales.delete", label: "Delete Sale" },
      { id: "sales.details.view", label: "View Sale Details" },
      { id: "sales.details.add", label: "Add Sale Detail" },
      { id: "sales.details.edit", label: "Edit Sale Detail" },
      { id: "sales.details.delete", label: "Delete Sale Detail" },
    ],
  },
  {
    module: "Reports",
    permissions: [
      { id: "reports.top-customers", label: "Top Customers" },
      { id: "reports.product-master", label: "Product Master List" },
      { id: "reports.top-products", label: "Top Products" },
      { id: "reports.active-employees", label: "Active Employees" },
      { id: "reports.all-employees", label: "All Employees" },
      { id: "reports.job-history", label: "Employee Job History" },
      { id: "reports.top-sales", label: "Top Sales" },
    ],
  },
]
