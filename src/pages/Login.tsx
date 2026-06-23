import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";

export function Login() {
  const { accounts, currentAccount, login } = useAppContext();
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? "");
  const navigate = useNavigate();
  const location = useLocation();
  if (currentAccount) return <Navigate to="/dashboard" replace />;

  const destination =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">June 2026 Philippines FHIR Connectathon</p>
        <h1>PHeRef Facility Login</h1>
        <p>Select a mock facility account. No password is required for this local demo.</p>
        <div className="account-picker">
          {accounts.map((account) => (
            <label
              className={`account-option ${selectedAccount === account.id ? "selected" : ""}`}
              key={account.id}
            >
              <input
                type="radio"
                name="demo-account"
                value={account.id}
                checked={selectedAccount === account.id}
                onChange={() => setSelectedAccount(account.id)}
              />
              <span>
                <strong>{account.username}</strong>
                <small>{account.displayName}</small>
                <small>{account.organizationName}</small>
              </span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            login(selectedAccount);
            navigate(destination, { replace: true });
          }}
        >
          Login to demo
        </button>
        <p className="login-note">LocalStorage session · synthetic Connectathon data only</p>
      </section>
    </main>
  );
}
