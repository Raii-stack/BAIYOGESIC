import { getPasswordStrength, strengthLevels } from "../../utils/password"

export default function PasswordStrengthMeter({
  password,
}: {
  password: string
}) {
  const strength = getPasswordStrength(password)
  const level = strengthLevels[strength]

  return (
    <div className="-mt-1 mb-5" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-slate-600">
          Password strength
        </p>
        <p className={`text-xs font-bold ${level.text}`}>{level.label}</p>
      </div>
      <div
        className="grid grid-cols-4 gap-1.5"
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength}
        aria-valuetext={level.label}
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`h-1.5 ${
              segment <= strength ? level.color : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Use 8 or more characters with uppercase, lowercase, numbers, and
        symbols.
      </p>
    </div>
  )
}
