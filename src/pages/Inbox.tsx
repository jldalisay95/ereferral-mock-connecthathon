import { useState } from "react";
import { ReferralTable } from "../components/ReferralTable";
import { useAppContext } from "../context/useAppContext";
import type { ReferralStatus } from "../types";

const filters: Array<[string, ReferralStatus[]]> = [
  ["New / requested", ["requested"]],
  ["Received", ["received"]],
  ["Accepted", ["accepted"]],
  ["In progress", ["in-progress"]],
  ["Rejected", ["rejected"]],
  ["Referred onward", ["referred-onward"]],
  ["Completed", ["completed"]]
];

export function Inbox() {
  const {
    currentAccount,
    endpoints,
    incomingReferrals,
    scopedNotifications,
    markNotificationRead,
    refreshLiveIncomingReferrals
  } = useAppContext();
  const [filter, setFilter] = useState("New / requested");
  const [message, setMessage] = useState("");
  const [loadingLive, setLoadingLive] = useState(false);
  const statuses = filters.find(([label]) => label === filter)?.[1] ?? [];
  const referrals =
    currentAccount?.role === "admin"
      ? incomingReferrals
      : incomingReferrals.filter((referral) => statuses.includes(referral.status));
  const unreadIds = new Set(
    scopedNotifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.referralId)
  );
  const canRefreshLive =
    currentAccount?.role === "facility_user" && !endpoints.demoMode;

  async function refreshLive() {
    setLoadingLive(true);
    setMessage("");
    try {
      const count = await refreshLiveIncomingReferrals();
      setMessage(`${count} live incoming referral(s) loaded for this facility.`);
    } catch (error) {
      setMessage(
        `Live incoming refresh failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoadingLive(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Receiving facility</p>
            <h2>Incoming Referrals</h2>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={refreshLive}
              disabled={!canRefreshLive || loadingLive}
            >
              {loadingLive ? "Loading live referrals..." : "Refresh live incoming"}
            </button>
          </div>
          <div className="filter-tabs" role="group" aria-label="Referral status filters">
            {filters.map(([label]) => (
              <button
                type="button"
                className={filter === label ? "" : "secondary"}
                key={label}
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {message ? <p>{message}</p> : null}
        {!canRefreshLive ? (
          <p className="notice">
            Live incoming refresh is available for facility accounts when demo
            mode is off.
          </p>
        ) : null}
        <ReferralTable
          referrals={referrals}
          unreadReferralIds={unreadIds}
          emptyMessage={`No incoming referrals in ${filter.toLowerCase()}.`}
        />
      </section>
      <section className="card">
        <h2>Notifications</h2>
        <div className="notification-list">
          {scopedNotifications.length ? scopedNotifications.map((notification) => (
            <article
              className={`notification ${notification.read ? "" : "unread"}`}
              key={notification.id}
            >
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
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
          )) : <p>No notifications for this facility.</p>}
        </div>
      </section>
    </div>
  );
}
