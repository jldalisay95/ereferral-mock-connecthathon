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
    incomingReferrals,
    scopedNotifications,
    markNotificationRead
  } = useAppContext();
  const [filter, setFilter] = useState("New / requested");
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
  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Receiving facility</p>
            <h2>Incoming Referrals</h2>
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
