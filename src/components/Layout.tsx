import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  ["/", "Dashboard"],
  ["/terminology", "Terminology Check"],
  ["/referrals/new", "New Referral"],
  ["/referrals/preview", "Preview & Submit"],
  ["/referrals/search", "Search Referrals"]
] as const;

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">June 2026 Philippines FHIR Connectathon</p>
          <h1>PHeRef Local EMR</h1>
        </div>
        <span className="synthetic-badge">Synthetic data only</span>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigation.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>
        Draft PHeRef 0.1.0 prototype. Not a production EMR and not for real patient data.
      </footer>
    </div>
  );
}
