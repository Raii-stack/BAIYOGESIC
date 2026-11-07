import { expect, test } from "vitest"
import { departmentPermissionPresets, getDepartmentPermissionPreset, getUserPermissionLabel } from "./users"

test.each(departmentPermissionPresets)("identifies the $id permission profile regardless of right order", (preset) => {
  const rights = [...preset.rights].reverse()
  rights.push(rights[0])
  expect(getDepartmentPermissionPreset(rights)).toBe(preset)
  expect(getUserPermissionLabel({ role: "employee", rights })).toBe(preset.label)
})

test("does not guess a department for customized or partial manager permissions", () => {
  const preset = departmentPermissionPresets.find((item) => item.id === "sales-manager")!
  for (const rights of [preset.rights.slice(1), [...preset.rights, "hr.access"]]) {
    expect(getDepartmentPermissionPreset(rights)).toBeUndefined()
    expect(getUserPermissionLabel({ role: "admin", rights })).toBe("Custom permissions")
  }
})

test("distinguishes role-based full access from an employee without permissions", () => {
  expect(getUserPermissionLabel({ role: "admin", rights: [] })).toBe("All Departments — Full Access")
  expect(getUserPermissionLabel({ role: "superadmin", rights: [] })).toBe("All Departments — Full Access")
  expect(getUserPermissionLabel({ role: "employee", rights: [] })).toBe("No permissions assigned")
})
