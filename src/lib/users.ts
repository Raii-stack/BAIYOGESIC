import type { PermissionGroup } from "../types/user"

export const permissionGroups: PermissionGroup[] = [
  {
    module: "Customer Management",
    accessRight: "customers.access",
    permissions: [
      { id: "customers.add", label: "Add Customer" },
      { id: "customers.edit", label: "Edit Customer" },
      { id: "customers.delete", label: "Delete Customer" },
    ],
  },
  {
    module: "Product Management",
    accessRight: "products.access",
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
    accessRight: "hr.access",
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
    accessRight: "sales.access",
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
    accessRight: "reports.access",
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
