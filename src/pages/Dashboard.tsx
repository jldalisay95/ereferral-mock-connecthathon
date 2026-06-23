import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReferralTable } from "../components/ReferralTable";
import { useAppContext } from "../context/useAppContext";
import { endpointList, getMetadata } from "../services/fhirClient";
import type { ReferralStatus } from "../types";

type ConnectionState = Record<string, "checking" | "online" | "offline">;

export function Dashboard() {
  const {
    currentAccount,
    endpoints,
    scopedReferrals,
    sentReferrals,
    incomingReferrals,
    scopedNotifications,
    unreadNotificationCount,
    markNotificationRead,
    activeDraftRecord
  } = useAppContext();
  const [connections, setConnections] = useState<ConnectionState>({});

  async function checkConnections() {
    const list = endpointList(endpoints);
    setConnections(Object.fromEntries(list.map((item) => [item.key, "checking"])));
    const results = await Promise.all(
      list.map(async (item) => {
        try {
          await getMetadata(item.url);
          return [item.key, "online"] as const;
        } catch {
          return [item.key, "offline"] as const;
        }
      })
    );
    setConnections(Object.fromEntries(results));
  }

  useEffect(() => {
    void checkConnections();
    // Endpoint changes intentionally trigger a capability refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoints.pherefBaseUrl, endpoints.phCoreBaseUrl, endpoints.terminologyBaseUrl]);

  if (!currentAccount) return null;
  const count = (items: typeof scopedReferrals, ...statuses: ReferralStatus[]) =>
    items.filter((referral) => statuses.includes(referral.status)).length;
  const facilityUser = currentAccount.role === "facility_user";

  return (
    <div className="page-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">
            {facilityUser ? "Facility dashboard" : "Connectathon administration"}
          </p>
          <h2>{currentAccount.organizationName}</h2>
          <p>
            A facility acts as sender or receiver according to each referral direction.
            {endpoints.demoMode
              ? " Demo mode keeps referral writes in this browser."
              : " Live mode sends referral writes to the configured PHeReF server."}
          </p>
        </div>
        <div className="quick-actions">
          {facilityUser ? (
            <Link className="button" to="/referrals/new">
              {activeDraftRecord ? "Continue referral" : "Generate referral"}
            </Link>
          ) : null}
          <Link className="button secondary" to="/referrals/incoming">
            Open incoming referrals
          </Link>
          <Link className="button secondary" to="/referrals">Open tracker</Link>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="Sent referrals" value={sentReferrals.length} />
        <Metric label="Incoming referrals" value={incomingReferrals.length} />
        <Metric label="Unread notifications" value={unreadNotificationCount} accent />
        <Metric label="Requested" value={count(scopedReferrals, "requested")} />
        <Metric label="In progress" value={count(scopedReferrals, "received", "accepted", "in-progress")} />
        <Metric label="Closed" value={count(scopedReferrals, "completed", "rejected", "referred-onward")} />
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">Notifications</p><h2>Latest updates</h2></div>
          <Link to="/referrals/incoming">View incoming</Link>
        </div>
        {scopedNotifications.length ? (
          <div className="notification-list">
            {scopedNotifications.slice(0, 5).map((notification) => (
              <article
                className={`notification ${notification.read ? "" : "unread"}`}
                key={notification.id}
              >
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{new Date(notification.createdAt).toLocaleString()}</small>
                </div>
                {!notification.read ? (
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : <p>No notifications for this facility.</p>}
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">Referral tracker</p><h2>Recently updated</h2></div>
          <Link to="/referrals">View all</Link>
        </div>
        <ReferralTable
          referrals={[...scopedReferrals]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 5)}
        />
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">FHIR endpoints</p><h2>Connection status</h2></div>
          <button type="button" className="secondary" onClick={checkConnections}>
            Check now
          </button>
        </div>
        <div className="status-grid">
          {endpointList(endpoints).map((item) => (
            <article key={item.key} className="status-card">
              <span className={`status-dot ${connections[item.key] ?? "checking"}`} />
              <div><strong>{item.label}</strong><small>{item.url}</small></div>
              <span>{connections[item.key] ?? "checking"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <article className={`metric-card ${accent ? "accent" : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
