export const strengthLevels = [
  { label: "Not set", color: "bg-slate-200", text: "text-slate-500" },
  { label: "Weak", color: "bg-red-500", text: "text-red-700" },
  { label: "Fair", color: "bg-amber-500", text: "text-amber-700" },
  { label: "Strong", color: "bg-blue-700", text: "text-blue-800" },
  {
    label: "Very strong",
    color: "bg-emerald-600",
    text: "text-emerald-700",
  },
] as const

export function getPasswordStrength(password: string) {
  if (!password) return 0

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1

  return Math.max(1, score)
}
