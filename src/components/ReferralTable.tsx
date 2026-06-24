import { Link } from "react-router-dom";
import type { ReferralRecord } from "../types";
import { StatusBadge } from "./StatusBadge";

interface ReferralTableProps {
  referrals: ReferralRecord[];
  emptyMessage?: string;
  unreadReferralIds?: Set<string>;
}

export function ReferralTable({
  referrals,
  emptyMessage = "No referrals match the current view.",
  unreadReferralIds = new Set()
}: ReferralTableProps) {
  if (!referrals.length) return <p className="empty-state">{emptyMessage}</p>;
  return (
    <div className="table-wrap">
      <table className="referral-table">
        <thead>
          <tr>
            <th>Referral ID</th>
            <th>Patient</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Updated</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((referral) => (
            <tr
              key={referral.id}
              className={unreadReferralIds.has(referral.id) ? "unread-row" : ""}
            >
              <td data-label="Referral ID">
                {unreadReferralIds.has(referral.id) ? <span className="new-dot" /> : null}
                <code>{referral.localReferralId}</code>
                <small>{new Date(referral.draft.authoredOn || referral.createdAt).toLocaleString()}</small>
              </td>
              <td data-label="Patient"><strong>{referral.patientName}</strong></td>
              <td data-label="From">{referral.referringOrganizationName}</td>
              <td data-label="To">{referral.receivingOrganizationName}</td>
              <td data-label="Reason">
                {referral.reason}
                <small>Priority: {referral.priority}</small>
              </td>
              <td data-label="Updated">{new Date(referral.updatedAt).toLocaleString()}</td>
              <td data-label="Status"><StatusBadge status={referral.status} /></td>
              <td data-label="Actions">
                <div className="table-actions">
                  <Link className="button compact" to={`/referrals/${referral.id}`}>View</Link>
                  <Link to={`/referrals/${referral.id}/print`}>Print</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
