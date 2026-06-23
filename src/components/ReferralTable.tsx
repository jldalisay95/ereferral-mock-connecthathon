import { Link } from "react-router-dom";
import type { ReferralRecord } from "../types";
import { StatusBadge } from "./StatusBadge";

interface ReferralTableProps {
  referrals: ReferralRecord[];
  emptyMessage?: string;
}

export function ReferralTable({
  referrals,
  emptyMessage = "No referrals match the current view."
}: ReferralTableProps) {
  if (!referrals.length) return <p>{emptyMessage}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Referral ID</th>
            <th>Date</th>
            <th>Patient</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((referral) => (
            <tr key={referral.id}>
              <td><code>{referral.localReferralId}</code></td>
              <td>{new Date(referral.draft.authoredOn || referral.createdAt).toLocaleDateString()}</td>
              <td>{referral.patientName}</td>
              <td>{referral.referringOrganizationName}</td>
              <td>{referral.receivingOrganizationName}</td>
              <td>{referral.reason}</td>
              <td><StatusBadge status={referral.status} /></td>
              <td>{new Date(referral.updatedAt).toLocaleString()}</td>
              <td><Link to={`/referrals/${referral.id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
