import { useEffect, useState } from "react";
import { registerRequest } from "./lib/auth-api.js";
import { useAuth } from "./auth/AuthContext.jsx";

const benefits = [
  "Protected enterprise session",
  "Organization-managed access",
  "Centralized ERP workspace",
];

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

function App() {
  const { user, login, logout } = useAuth();
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    setLoading(true);
    setToast(null);

    try {
      if (mode === "register") {
        const firstName = String(formData.get("firstName") || "").trim();
        const lastName = String(formData.get("lastName") || "").trim();
        if (!firstName || !lastName || !email) {
          setToast({ type: "error", message: "Enter your first name, last name, and work email." });
          return;
        }

        await registerRequest({ firstName, lastName, email });
        form.reset();
        setMode("login");
        setToast({
          type: "success",
          message: "Account request submitted. Your account will be available after administrator approval.",
        });
        return;
      }

      await login({ email, password: String(formData.get("password") || "") });
      form.reset();
      setToast({ type: "success", message: "You are signed in." });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setToast(null);
    try {
      await logout();
      setToast({ type: "success", message: "You have been signed out." });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to sign out. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setToast(null);
  }

  const userName =
    [user?.firstName || user?.first_name, user?.lastName || user?.last_name]
      .filter(Boolean)
      .join(" ") || user?.email;

  return (
    <main className="auth-shell grid min-h-screen grid-rows-[1fr_auto] bg-[#edf1f5] px-6 py-8 text-[#020618] sm:px-8">
      {toast && (
        <div
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          className={`auth-toast fixed right-5 top-5 z-20 max-w-[min(28rem,calc(100vw-2.5rem))] rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}

      <section
        aria-label="Sign in to HOPE"
        className="auth-card mx-auto grid w-full max-w-[1152px] overflow-hidden rounded-2xl border border-[#cad5e2] bg-white shadow-[0_24px_70px_rgba(15,39,67,0.1)]"
      >
        <aside className="auth-sidebar flex flex-col bg-[#0d2743] p-8 text-white sm:p-12">
          <a className="brand flex w-fit items-center gap-[14px]" href="/" aria-label="HOPE, Inc. home">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/20 bg-white">
              <img src="/assets/hope-mark.svg" alt="" className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-bold leading-7 tracking-[-0.45px]">HOPE, Inc.</span>
              <span className="text-[10px] font-semibold uppercase leading-[15px] tracking-[1.6px] text-[#bedbff]">
                Enterprise Resource Planning
              </span>
            </span>
          </a>

          <div className="flex flex-1 flex-col justify-center py-14">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-light leading-10 tracking-[-1.8px] text-white/30">01</span>
              <span className="h-px w-10 bg-[#8ec5ff]/50" />
              <span className="text-[11px] font-bold uppercase tracking-[2.2px] text-[#bedbff]">
                Authentication
              </span>
            </div>
            <h1 className="mt-7 max-w-[375px] text-3xl font-semibold leading-[1.25] tracking-[-1.26px] sm:text-[36px]">
              Your work. One secure entry.
            </h1>
            <p className="mt-4 max-w-[320px] text-sm leading-6 text-[#cad5e2]">
              A focused gateway to the systems, workflows, and records your organization relies on.
            </p>
          </div>

          <ul className="space-y-2 border-t border-white/[0.15] pt-6 text-xs font-medium leading-4 text-[#cad5e2]">
            {benefits.map((benefit) => (
              <li className="flex items-center gap-3" key={benefit}>
                <span aria-hidden="true" className="size-[6px] shrink-0 bg-[#8ec5ff]" />
                {benefit}
              </li>
            ))}
          </ul>
        </aside>

        <div className="auth-content flex items-center px-8 py-12 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-[440px]">
            {user ? (
              <section aria-labelledby="welcome-heading">
                <p className="text-[11px] font-bold uppercase leading-[17px] tracking-[1.98px] text-[#193cb8]">
                  HOPE secure identity
                </p>
                <h2
                  className="mt-2 text-[30px] font-bold leading-tight tracking-[-1.19px] sm:text-[34px]"
                  id="welcome-heading"
                >
                  Welcome to your workspace
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#45556c]">
                  Signed in as <span className="font-semibold text-[#314158]">{userName}</span>.
                </p>
                {user.status && (
                  <p className="mt-2 text-sm text-[#45556c]">
                    Account status: <span className="font-medium capitalize">{user.status}</span>
                  </p>
                )}
                <button
                  className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#193cb8] px-5 text-sm font-semibold text-white transition hover:bg-[#1533a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8] disabled:cursor-wait disabled:opacity-70"
                  disabled={loading}
                  onClick={handleLogout}
                  type="button"
                >
                  {loading ? <Spinner /> : null}
                  {loading ? "Signing out..." : "Sign out"}
                </button>
              </section>
            ) : (
              <>
                <header>
                  <p className="text-[11px] font-bold uppercase leading-[17px] tracking-[1.98px] text-[#193cb8]">
                    HOPE secure identity
                  </p>
                  <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-1.19px] sm:whitespace-nowrap sm:text-[34px]">
                    {mode === "login" ? "Sign in to your workspace" : "Request an account"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#45556c]">
                    {mode === "login"
                      ? "Use your corporate credentials to continue to your organization."
                      : "Enter your details to request access to your organization."}
                  </p>
                </header>

                <form
                  aria-busy={loading}
                  className="mt-8"
                  key={mode}
                  onSubmit={handleSubmit}
                >
                  {mode === "register" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          className="block text-[13px] font-semibold leading-5 text-[#314158]"
                          htmlFor="firstName"
                        >
                          First name
                        </label>
                        <input
                          autoComplete="given-name"
                          className="mt-2 h-12 w-full rounded-lg border border-[#cad5e2] bg-white px-4 text-sm outline-none transition placeholder:text-[#90a1b9] focus:border-[#193cb8] focus:ring-2 focus:ring-[#193cb8]/15"
                          id="firstName"
                          maxLength={100}
                          name="firstName"
                          placeholder="First name"
                          required
                        />
                      </div>
                      <div>
                        <label
                          className="block text-[13px] font-semibold leading-5 text-[#314158]"
                          htmlFor="lastName"
                        >
                          Last name
                        </label>
                        <input
                          autoComplete="family-name"
                          className="mt-2 h-12 w-full rounded-lg border border-[#cad5e2] bg-white px-4 text-sm outline-none transition placeholder:text-[#90a1b9] focus:border-[#193cb8] focus:ring-2 focus:ring-[#193cb8]/15"
                          id="lastName"
                          maxLength={100}
                          name="lastName"
                          placeholder="Last name"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <label
                    className="mt-4 block text-[13px] font-semibold leading-5 text-[#314158]"
                    htmlFor="email"
                  >
                    Work email
                  </label>
                  <div className="relative mt-2">
                    <img
                      src="/assets/email.svg"
                      alt=""
                      className="pointer-events-none absolute left-[14px] top-1/2 z-10 size-[18px] -translate-y-1/2"
                    />
                    <input
                      autoComplete="username"
                      className="h-12 w-full rounded-lg border border-[#cad5e2] bg-white pl-11 pr-4 text-sm text-[#020618] outline-none transition placeholder:text-[#90a1b9] focus:border-[#193cb8] focus:ring-2 focus:ring-[#193cb8]/15"
                      id="email"
                      maxLength={254}
                      name="email"
                      placeholder="name@company.com"
                      required
                      type="email"
                    />
                  </div>

                  {mode === "login" && (
                    <>
                      <label
                        className="mt-4 block text-[13px] font-semibold leading-5 text-[#314158]"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <div className="relative mt-2">
                        <img
                          src="/assets/lock.svg"
                          alt=""
                          className="pointer-events-none absolute left-[14px] top-1/2 z-10 size-[18px] -translate-y-1/2"
                        />
                        <input
                          autoComplete="current-password"
                          className="h-12 w-full rounded-lg border border-[#cad5e2] bg-white pl-11 pr-12 text-sm text-[#020618] outline-none transition placeholder:text-[#90a1b9] focus:border-[#193cb8] focus:ring-2 focus:ring-[#193cb8]/15"
                          id="password"
                          name="password"
                          placeholder="Enter your password"
                          required
                          type={showPassword ? "text" : "password"}
                        />
                        <button
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md transition hover:bg-[#edf1f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8]"
                          onClick={() => setShowPassword((visible) => !visible)}
                          type="button"
                        >
                          <img src="/assets/eye.svg" alt="" className="size-5" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-[10px] text-[13px] font-medium leading-5 text-[#45556c]">
                          <input
                            className="size-4 rounded-sm accent-[#193cb8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8]"
                            name="remember"
                            type="checkbox"
                          />
                          Remember me
                        </label>
                        <button
                          className="text-[13px] font-semibold leading-5 text-[#193cb8] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8]"
                          onClick={() =>
                            setToast({
                              type: "error",
                              message: "For password help, contact your system administrator.",
                            })
                          }
                          type="button"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </>
                  )}

                  <button
                    className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#193cb8] px-5 text-sm font-semibold text-white transition hover:bg-[#1533a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8] active:bg-[#102982] disabled:cursor-wait disabled:opacity-70"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        {mode === "login" ? "Signing in..." : "Submitting..."}
                      </>
                    ) : (
                      <>
                        {mode === "login" ? "Sign in" : "Submit account request"}
                        {mode === "login" && (
                          <img src="/assets/arrow-right.svg" alt="" className="size-4" />
                        )}
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 border-t border-[#e2e8f0] pt-6 text-sm leading-5 text-[#45556c]">
                  {mode === "login" ? (
                    <>
                      Authorized HR or system administrator?{" "}
                      <button
                        className="font-semibold text-[#193cb8] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8]"
                        onClick={() => switchMode("register")}
                        type="button"
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        className="font-semibold text-[#193cb8] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193cb8]"
                        onClick={() => switchMode("login")}
                        type="button"
                      >
                        Sign in
                      </button>
                      <p className="mt-3 text-xs leading-5 text-[#62748e]">
                        New accounts remain pending until approved by an administrator. Passwords
                        are configured after approval.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1152px] items-center justify-between gap-4 pt-5 text-xs leading-4 text-[#62748e]">
        <p>© 2026 HOPE, Inc. All rights reserved.</p>
        <nav aria-label="Legal and support" className="flex gap-5">
          <a className="hover:text-[#193cb8]" href="#privacy">Privacy</a>
          <a className="hover:text-[#193cb8]" href="#security">Security</a>
          <a className="hover:text-[#193cb8]" href="#support">Support</a>
        </nav>
      </footer>
    </main>
  );
}

export default App;
