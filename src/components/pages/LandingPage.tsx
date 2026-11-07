import { useEffect } from "react"
import { Link, Navigate } from "react-router"

import { Logo } from "../auth/AuthComponents"
import { useAuth } from "../auth/AuthProvider"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import "./LandingPage.css"

const modules = [
  { title: "Sales & customers", description: "From customer records to sales transactions and payments. Keep the details of every relationship together." },
  { title: "Inventory & pricing", description: "Organize your product catalog and follow price history, with the right price for each transaction date." },
  { title: "People & reports", description: "Maintain employee records and job history. Review your business through focused, ready-to-print reports." },
]

export default function LandingPage() {
  const { user, loading } = useAuth()

  useEffect(() => { document.title = "HOPE, Inc. | ERP Workspace" }, [])

  if (loading) return <div role="status" className="grid min-h-screen place-items-center bg-[#f6f6f7] text-sm text-neutral-500">Checking your session…</div>
  if (user?.status === "active" && !user.isBlocked) return <Navigate to="/dashboard" replace />

  return (
    <div className="hope-landing">
      <a href="#main-content" className="hope-skip-link">Skip to content</a>
      <main id="main-content">
        <section aria-labelledby="landing-heading" className="hope-hero">
          <img className="hope-hero-image" src="/assets/hope-operations-hero.webp" alt="" fetchPriority="high" />
          <header className="hope-header hope-container">
            <Logo inverse />
            <nav aria-label="Main navigation" className="hope-navigation">
              <a href="#workspace" className="hope-nav-detail">The workspace</a>
              <a href="#access" className="hope-nav-detail">Team access</a>
              <Link
                to="/register"
                className="hope-button hope-button-outline"
              >
                Register
              </Link>
              <Link to="/login" className="hope-button hope-button-light">Sign in<DashboardIcon name="arrowUpRight" className="h-4 w-4 shrink-0" /></Link>
            </nav>
          </header>

          <div className="hope-hero-content hope-container">
            <p className="hope-eyebrow">Run your entire business with confidence</p>
            <h1 id="landing-heading">
              <span>Your business,</span>{" "}
              <span>connected in one</span>{" "}
              <span>ERP workspace.</span>
            </h1>
            <p className="hope-hero-description">Bring your people, products, and everyday operations together. One place to keep work moving.</p>
            <div className="hope-hero-actions">
              <Link to="/login" className="hope-button hope-button-light">Sign in to your workspace<DashboardIcon name="arrowUpRight" className="h-4 w-4 shrink-0" /></Link>
              <Link
                to="/register"
                className="hope-button hope-button-outline"
              >
                Register for an account<DashboardIcon name="arrowRight" className="h-4 w-4 shrink-0" />
              </Link>
            </div>
            <a href="#workspace" className="hope-text-link">Explore the workspace<DashboardIcon name="arrowDown" className="h-4 w-4 shrink-0" /></a>
          </div>
        </section>

        <section id="workspace" aria-labelledby="workspace-heading" className="hope-workspace">
          <div className="hope-container">
            <h2 id="workspace-heading" className="hope-statement">Less switching.<br /><span>More getting things done.</span></h2>
            <div className="hope-module-layout">
              <div className="hope-module-intro">
                <p className="hope-eyebrow">Built around your work</p>
                <h3>The everyday details.<br />All in one place.</h3>
                <p>Sales, inventory, customers, employees, and reports. Connected in your HOPE workspace, with access managed for your team.</p>
              </div>
              <div className="hope-module-list">
                {modules.map((module, index) => (
                  <div key={module.title} className="hope-module">
                    <span className="hope-module-number" aria-hidden="true">0{index + 1}</span>
                    <div><h3>{module.title}</h3><p>{module.description}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="access" aria-labelledby="access-heading" className="hope-access">
          <div className="hope-container hope-access-content">
            <div><p className="hope-eyebrow">Your next step</p><h2 id="access-heading">A place for<br />your team to work.</h2></div>
            <div className="hope-access-action">
              <p>Already part of HOPE? Your workspace is ready when you are.</p>
              <div className="hope-access-buttons">
                <Link to="/login" className="hope-button hope-button-dark">Open your workspace<DashboardIcon name="arrowUpRight" className="h-4 w-4 shrink-0" /></Link>
                <Link
                  to="/register"
                  className="hope-button hope-button-outline"
                >
                  Register
                </Link>
              </div>
              <p className="hope-access-note">Need elevated access? Contact your administrator.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="hope-footer hope-container">
        <Logo inverse />
        <p>© {new Date().getFullYear()} HOPE, Inc. All rights reserved.</p>
        <a href="#main-content">Back to top<DashboardIcon name="arrowUp" className="h-3.5 w-3.5 shrink-0" /></a>
      </footer>

    </div>
  )
}
