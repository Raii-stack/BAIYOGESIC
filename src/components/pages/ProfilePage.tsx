import { useAuth } from "../auth/AuthProvider"
import DashboardLayout from "../../layouts/DashboardLayout"
import { getUserDisplayName, getUserInitials } from "../../lib/auth"

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1.5 px-5 py-4 text-[13px] sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5"><dt className="text-neutral-500">{label}</dt><dd className={`min-w-0 font-medium text-neutral-800 [overflow-wrap:anywhere] ${label === "Role" || label === "Account status" ? "capitalize" : ""}`}>{value}</dd></div>
}

export default function ProfilePage() {
  const { user } = useAuth()
  const displayName = getUserDisplayName(user)
  const accountStatus = user?.isBlocked ? "Blocked" : user?.status || "Not available"
  const sections = [
    {
      title: "Personal information",
      description: "The name and email address associated with your account.",
      details: [{ label: "Full name", value: displayName }, { label: "Email address", value: user?.email || "—" }],
    },
    {
      title: "Employment",
      description: "Your employee record at HOPE, Inc.",
      details: [{ label: "Employee number", value: user?.empno || "—" }, { label: "Job title", value: user?.jobTitle || "Not assigned" }, { label: "Department", value: user?.departmentName || "Not assigned" }],
    },
    {
      title: "Account access",
      description: "Your role determines which tools and actions you can use.",
      details: [{ label: "Role", value: user?.role || "—" }, { label: "Account status", value: accountStatus }],
    },
  ]

  return (
    <DashboardLayout activeNavigation="My account">
      <main className="workspace-page">
        <div className="mx-auto max-w-5xl">
          <header className="workspace-page-header"><div><h1 className="workspace-page-title">My account</h1><p className="workspace-page-description">Your personal information, employment details, and account access.</p></div></header>

          <section aria-label="Current user profile" className="workspace-panel mb-7 flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#c5eed2] text-lg font-semibold text-[#163c25]">{getUserInitials(user)}</span>
            <div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold text-neutral-900">{displayName}</h2><p className="mt-1 text-[13px] text-neutral-500 [overflow-wrap:anywhere]">{user?.email || "—"}</p></div>
            <span className={`workspace-badge workspace-profile-badge gap-1.5 capitalize ${accountStatus === "active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${accountStatus === "active" ? "bg-emerald-600" : "bg-neutral-400"}`} />{accountStatus}</span>
          </section>

          <div className="divide-y divide-neutral-200">
            {sections.map((section) => (
              <section key={section.title} aria-label={section.title} className="grid gap-4 py-6 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
                <div className="pt-1"><h2 className="text-sm font-semibold text-neutral-900">{section.title}</h2><p className="mt-2 text-[13px] leading-5 text-neutral-500">{section.description}</p></div>
                <dl className="workspace-panel divide-y divide-neutral-100">{section.details.map((detail) => <Detail key={detail.label} {...detail} />)}</dl>
              </section>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-5 text-neutral-500">Need to change your details? Contact your administrator.</p>
        </div>
      </main>
    </DashboardLayout>
  )
}
