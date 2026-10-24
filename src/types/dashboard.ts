export type DashboardIconName = "dashboard" | "profile" | "settings" | "search" | "bell" | "menu" | "collapse" | "crm" | "inventory" | "hr" | "sales" | "reports" | "userManagement"

export type NavigationItem = {
  label: string
  icon: DashboardIconName
  href?: string
  active?: boolean
}

export type ModuleDefinition = {
  id: string
  title: string
  description: string
  href: string
  icon: DashboardIconName
  visible: boolean
}
