import { useEffect, useState, type FormEvent } from "react"
import type { EmployeeInput, Lookup } from "../../lib/employee-api"
import type { Employee } from "../../types/employee"

const field = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-3 focus:ring-blue-100"
const empty: EmployeeInput = { firstname: "", lastname: "", email: "", gender: "", birthdate: "", hiredate: "", sepdate: "", jobcode: "", deptcode: "", effdate: "", salary: 0 }
const businessDate = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value || ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

export default function EmployeePanel({ employee, open, departments, jobs, onClose, onSave }: {
  employee: Employee | null; open: boolean; departments: Lookup[]; jobs: Lookup[]
  onClose: () => void; onSave: (input: EmployeeInput) => Promise<void>
}) {
  const [form, setForm] = useState<EmployeeInput>(empty)
  const [salaryText, setSalaryText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    setForm(employee ? {
      firstname: employee.firstName || "", lastname: employee.lastName || "", email: employee.email || "",
      gender: employee.gender || "", birthdate: employee.birthDate || "", hiredate: employee.hireDate || "",
      sepdate: employee.separationDate || "", jobcode: employee.jobCode || "", deptcode: employee.departmentCode || "",
      effdate: businessDate(), salary: employee.salary,
    } : empty)
    setSalaryText(employee ? String(employee.salary) : "")
    setError("")
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [employee, open, onClose])

  if (!open) return null
  const set = <K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      await onSave({ ...form, firstname: form.firstname.trim(), lastname: form.lastname.trim(), email: form.email.trim(), salary: Number(salaryText), effdate: form.effdate || form.hiredate })
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save employee.") }
    finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-50"><button type="button" aria-label="Close employee form" onClick={onClose} className="absolute inset-0 bg-slate-950/50" /><aside role="dialog" aria-modal="true" aria-labelledby="employee-panel-title" className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-300 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.14)]">
    <header className="flex items-start justify-between gap-6 border-b border-slate-300 px-6 py-6 sm:px-8"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">Human Resources / Employee record</p><h2 id="employee-panel-title" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">{employee ? "Edit employee" : "Add employee"}</h2><p className="mt-2 text-sm text-slate-600">Personnel details and current assignment</p></div><button type="button" onClick={onClose} aria-label="Close employee form" className="grid h-10 w-10 place-items-center rounded-md text-xl text-slate-500 hover:bg-slate-100">×</button></header>
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8"><div className="grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-2"><Label>Employee ID</Label><input readOnly value={employee?.id ?? "Auto-generated on save"} className={`${field} bg-slate-100 text-slate-500`} /></label>
      <label><Label>First name</Label><input required maxLength={15} value={form.firstname} onChange={(event) => set("firstname", event.target.value)} className={field} /></label>
      <label><Label>Last name</Label><input required maxLength={15} value={form.lastname} onChange={(event) => set("lastname", event.target.value)} className={field} /></label>
      <label className="sm:col-span-2"><Label>Work email</Label><input type="email" required value={form.email} onChange={(event) => set("email", event.target.value)} className={field} /></label>
      <label><Label>Gender (optional)</Label><select value={form.gender} onChange={(event) => set("gender", event.target.value as EmployeeInput["gender"])} className={field}><option value="">Not specified</option><option value="M">Male</option><option value="F">Female</option></select></label>
      <label><Label>Birth date (optional)</Label><input type="date" value={form.birthdate} onChange={(event) => set("birthdate", event.target.value)} className={field} /></label>
      <label><Label>Hire date</Label><input type="date" required value={form.hiredate} onChange={(event) => set("hiredate", event.target.value)} className={field} /></label>
      <label><Label>Separation date (optional)</Label><input type="date" min={form.hiredate || undefined} value={form.sepdate} onChange={(event) => set("sepdate", event.target.value)} className={field} /></label>
      <label><Label>Department</Label><select required value={form.deptcode} onChange={(event) => set("deptcode", event.target.value)} className={field}><option value="">Select department</option>{departments.map((item) => <option key={item.code} value={item.code}>{item.name || item.code}</option>)}</select></label>
      <label><Label>Job title</Label><select required value={form.jobcode} onChange={(event) => set("jobcode", event.target.value)} className={field}><option value="">Select job title</option>{jobs.map((item) => <option key={item.code} value={item.code}>{item.name || item.code}</option>)}</select></label>
      <label><Label>Salary</Label><input type="number" required min="0" step="0.01" value={salaryText} onChange={(event) => setSalaryText(event.target.value)} className={field} /></label>
      <label><Label>Job effective date</Label><input type="date" required min={form.hiredate || undefined} value={form.effdate || form.hiredate} onChange={(event) => set("effdate", event.target.value)} className={field} /></label>
    </div>{employee && <p className="mt-5 text-xs leading-5 text-slate-500">Changing the department, job title, or salary records a new job-history entry on the effective date.</p>}{error && <p role="alert" className="mt-5 text-sm font-semibold text-red-700">{error}</p>}</div>
    <footer className="flex items-center justify-end gap-3 border-t border-slate-300 px-6 py-4 sm:px-8"><button type="button" onClick={onClose} className="h-11 rounded-md border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving || jobs.length === 0 || departments.length === 0} className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">{saving ? "Saving…" : employee ? "Save changes" : "Create employee"}</button></footer>
    </form>
  </aside></div>
}

function Label({ children }: { children: React.ReactNode }) { return <span className="mb-2 block text-xs font-bold text-slate-700">{children}</span> }
