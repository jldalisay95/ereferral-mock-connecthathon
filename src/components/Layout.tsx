import { NavLink, Outlet } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";

export function Layout() {
  const { currentAccount, unreadNotificationCount, logout } = useAppContext();
  if (!currentAccount) return null;

  const facilityUser = currentAccount.role === "facility_user";
  const navigation = [
    ["/dashboard", "Dashboard", true],
    ["/patients", "Patient Registry", facilityUser],
    ["/referrals/new", "Generate Referral", facilityUser],
    ["/referrals/sent", "Sent Referrals", true],
    [
      "/referrals/incoming",
      `Incoming Referrals${unreadNotificationCount ? ` (${unreadNotificationCount})` : ""}`,
      true
    ],
    ["/referrals", "Referral Tracker", true],
    ["/referrals/search", "Remote Search", true],
    ["/terminology", "Terminology Check", true],
    ["/settings", "Settings", currentAccount.role === "admin"]
  ] as const;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Connectathon eReferral Demo</p>
          <h1>Local Referral EMR</h1>
        </div>
        <div className="account-panel">
          <span className="synthetic-badge">Synthetic data only</span>
          <div>
            <strong>{currentAccount.displayName}</strong>
            <small>{currentAccount.organizationName}</small>
          </div>
          <button type="button" className="secondary compact" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigation
          .filter(([, , visible]) => visible)
          .map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/referrals"}>
              {label}
            </NavLink>
          ))}
      </nav>
      <main><Outlet /></main>
      <footer>
        Draft PHeReF v0.1 workflow demonstration. Never use real patient data.
      </footer>
    </div>
  );
}
