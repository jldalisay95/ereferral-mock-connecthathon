import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReferralTable } from "../components/ReferralTable";
import { useAppContext } from "../context/useAppContext";
import { getMetadata, endpointList } from "../services/fhirClient";
import type { ReferralStatus } from "../types";

type ConnectionState = Record<string, "checking" | "online" | "offline">;

export function Dashboard() {
  const {
    currentAccount,
    endpoints,
    scopedReferrals,
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
  const count = (...statuses: ReferralStatus[]) =>
    scopedReferrals.filter((referral) => statuses.includes(referral.status)).length;
  const roleTitle =
    currentAccount.role === "referring_facility_user"
      ? "Referring facility dashboard"
      : currentAccount.role === "receiving_facility_user"
        ? "Receiving facility dashboard"
        : "Connectathon administration dashboard";

  return (
    <div className="page-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">{roleTitle}</p>
          <h2>{currentAccount.organizationName}</h2>
          <p>
            {endpoints.demoMode
              ? "Demo mode is on: validation and reads may use live servers, while submissions and workflow writes stay local."
              : "Live mode is on: submissions and Task updates are sent to the configured PHeRef CDR."}
          </p>
        </div>
        <div className="quick-actions">
          {currentAccount.role === "referring_facility_user" ? (
            <Link className="button" to="/referrals/new">
              {activeDraftRecord ? "Continue referral" : "New referral"}
            </Link>
          ) : null}
          {currentAccount.role !== "referring_facility_user" ? (
            <Link className="button" to="/inbox">Open referral inbox</Link>
          ) : null}
          <Link className="button secondary" to="/referrals">Open tracker</Link>
        </div>
      </section>

      <section className="metric-grid">
        {currentAccount.role === "referring_facility_user" ? (
          <>
            <Metric label="Sent" value={scopedReferrals.filter((item) => item.submittedAt).length} />
            <Metric label="Draft" value={count("draft", "error")} />
            <Metric label="Pending / active" value={count("submitted", "requested", "received", "in-progress")} />
            <Metric label="Accepted" value={count("accepted")} />
            <Metric label="Rejected" value={count("rejected", "referred-onward")} />
            <Metric label="Completed" value={count("completed")} />
          </>
        ) : (
          <>
            <Metric label="New" value={count("requested")} accent />
            <Metric label="Unread notifications" value={unreadNotificationCount} accent />
            <Metric label="Received" value={count("received")} />
            <Metric label="Accepted" value={count("accepted")} />
            <Metric label="Rejected / forwarded" value={count("rejected", "referred-onward")} />
            <Metric label="Completed" value={count("completed")} />
          </>
        )}
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">Notifications</p><h2>Latest status updates</h2></div>
          {currentAccount.role !== "referring_facility_user" ? <Link to="/inbox">View inbox</Link> : null}
        </div>
        {scopedNotifications.length ? (
          <div className="notification-list">
            {scopedNotifications.slice(0, 5).map((notification) => (
              <article className={`notification ${notification.read ? "" : "unread"}`} key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{new Date(notification.createdAt).toLocaleString()}</small>
                </div>
                {!notification.read ? (
                  <button type="button" className="secondary compact" onClick={() => markNotificationRead(notification.id)}>
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
        <ReferralTable referrals={[...scopedReferrals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)} />
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">FHIR endpoints</p><h2>Connection status</h2></div>
          <button type="button" className="secondary" onClick={checkConnections}>Check now</button>
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

interface MetricProps {
  label: string;
  value: number;
  accent?: boolean;
}

function Metric({ label, value, accent = false }: MetricProps) {
  return (
    <article className={`metric-card ${accent ? "accent" : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
