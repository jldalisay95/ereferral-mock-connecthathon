import { NavLink, Outlet } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";

export function Layout() {
  const { currentAccount, unreadNotificationCount, logout } = useAppContext();
  if (!currentAccount) return null;

  const navigation = [
    ["/dashboard", "Dashboard", true],
    ["/referrals", currentAccount.role === "referring_facility_user" ? "Sent Referrals" : "Referral Tracker", true],
    ["/inbox", `Inbox${unreadNotificationCount ? ` (${unreadNotificationCount})` : ""}`, currentAccount.role !== "referring_facility_user"],
    ["/referrals/new", "New Referral", currentAccount.role === "referring_facility_user"],
    ["/referrals/search", "Remote Search", true],
    ["/terminology", "Terminology", true],
    ["/settings", "Settings", currentAccount.role === "admin"]
  ] as const;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">June 2026 Philippines FHIR Connectathon</p>
          <h1>PHeRef Local EMR</h1>
        </div>
        <div className="account-panel">
          <span className="synthetic-badge">Synthetic data only</span>
          <div>
            <strong>{currentAccount.displayName}</strong>
            <small>{currentAccount.organizationName}</small>
          </div>
          <button type="button" className="secondary compact" onClick={logout}>Logout</button>
        </div>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigation
          .filter(([, , visible]) => visible)
          .map(([to, label]) => (
            <NavLink key={to} to={to}>{label}</NavLink>
          ))}
      </nav>
      <main><Outlet /></main>
      <footer>
        Draft PHeRef 0.1.0 prototype. Local mock persistence; never use real patient data.
      </footer>
    </div>
  );
}
