export type DashboardIconName = "dashboard" | "profile" | "settings" | "search" | "bell" | "menu" | "collapse" | "crm" | "inventory" | "hr" | "sales"

export type NavigationItem = {
  label: string
  icon: DashboardIconName
  active?: boolean
}

export type ModuleDefinition = {
  id: string
  index: string
  title: string
  description: string
  href?: string
  icon: DashboardIconName
  accent: string
  iconStyle: string
  visible: boolean
}
