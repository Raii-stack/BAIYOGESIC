import type { SystemUser } from "../../types/user"

export default function UserTable({
  users,
  onToggleBlock,
  onOpenRights,
}: {
  users: SystemUser[]
  onToggleBlock: (userId: string) => void
  onOpenRights: (user: SystemUser) => void
}) {
  return (
    <div className="overflow-hidden border border-slate-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {["Name", "Email", "Role", "Status", "Actions"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 first:pl-6 last:pr-6"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.id}
                className={`border-b border-slate-200 last:border-b-0 ${
                  user.status === "Blocked"
                    ? "bg-red-50/70"
                    : index % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50"
                }`}
              >
                <td className="px-5 py-4 pl-6">
                  <p className="text-sm font-bold text-slate-900">
                    {user.name}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    {user.id}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {user.email}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex border px-2 py-1 text-[10px] font-bold tracking-[0.1em] ${
                      user.role === "SUPERADMIN"
                        ? "border-blue-950 bg-[#0d2743] text-white"
                        : user.role === "ADMIN"
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                      user.status === "Blocked"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-4 pr-6">
                  {user.role !== "USER" ? (
                    <span
                      aria-label="Privileged accounts cannot be modified"
                      className="text-sm text-slate-400"
                    >
                      -
                    </span>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => onToggleBlock(user.id)}
                        className={`text-xs font-bold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 ${
                          user.status === "Blocked"
                            ? "text-emerald-700 focus-visible:ring-emerald-600"
                            : "text-red-700 focus-visible:ring-red-600"
                        }`}
                      >
                        {user.status === "Blocked" ? "Unblock" : "Block"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenRights(user)}
                        className="text-xs font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                      >
                        Rights
                      </button>
                      <button
                        type="button"
                        className="text-xs font-bold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="px-6 py-14 text-center text-sm text-slate-500">
          No user accounts match this search.
        </div>
      )}

      <div className="border-t border-slate-300 px-6 py-4 text-xs font-medium text-slate-600">
        Showing {users.length} user accounts
      </div>
    </div>
  )
}
