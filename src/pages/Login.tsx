import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import { DEMO_ACCOUNTS } from "../data/facilities";

export function Login() {
  const { connectathonConfig, currentAccount, login } = useAppContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  if (currentAccount) return <Navigate to="/dashboard" replace />;

  const destination =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      login(username, password);
      navigate(destination, { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">June 2026 Philippines FHIR Connectathon</p>
        <h1>Local EMR eReferral Mock</h1>
        <p>Sign in with a synthetic facility account.</p>
        {message ? <div className="notice danger">{message}</div> : null}
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>Username</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!username || !password}>Login</button>
        </form>
        <div className="button-row login-register-action">
          {connectathonConfig.preset === "participant" ? (
            <Link className="button" to="/participant-setup">
              Configure Participant Starter
            </Link>
          ) : null}
          <Link className="button secondary" to="/register">
            Create a facility account
          </Link>
        </div>
        <div className="demo-accounts">
          <span>Demo accounts</span>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              type="button"
              className="secondary compact"
              key={account.id}
              onClick={() => {
                setUsername(account.username);
                setPassword(account.password);
                setMessage("");
              }}
            >
              {account.username}
            </button>
          ))}
        </div>
        <p className="login-note">
          Password for all accounts: <code>demo123</code>. Synthetic data only.
        </p>
      </section>
    </main>
  );
}
