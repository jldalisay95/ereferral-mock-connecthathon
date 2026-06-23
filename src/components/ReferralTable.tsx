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
  if (!referrals.length) return <p>{emptyMessage}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Referral ID</th>
            <th>Date / time</th>
            <th>Patient</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((referral) => (
            <tr
              key={referral.id}
              className={unreadReferralIds.has(referral.id) ? "unread-row" : ""}
            >
              <td>
                {unreadReferralIds.has(referral.id) ? <span className="new-dot" /> : null}
                <code>{referral.localReferralId}</code>
              </td>
              <td>{new Date(referral.draft.authoredOn || referral.createdAt).toLocaleString()}</td>
              <td>{referral.patientName}</td>
              <td>{referral.referringOrganizationName}</td>
              <td>{referral.receivingOrganizationName}</td>
              <td>{referral.reason}</td>
              <td>{referral.priority}</td>
              <td><StatusBadge status={referral.status} /></td>
              <td>{new Date(referral.updatedAt).toLocaleString()}</td>
              <td>
                <div className="table-actions">
                  <Link to={`/referrals/${referral.id}`}>View</Link>
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
