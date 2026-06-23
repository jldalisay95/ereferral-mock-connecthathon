import { useState } from "react";
import { ReferralTable } from "../components/ReferralTable";
import { useAppContext } from "../context/useAppContext";
import { REFERRAL_STATUS_LABELS } from "../services/referralRecords";
import type { ReferralStatus } from "../types";

export function ReferralTracker() {
  const { currentAccount, scopedReferrals } = useAppContext();
  const [status, setStatus] = useState<ReferralStatus | "all">("all");
  const filtered = status === "all"
    ? scopedReferrals
    : scopedReferrals.filter((referral) => referral.status === status);
  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Facility-scoped records</p>
            <h2>{currentAccount?.role === "referring_facility_user" ? "Sent referrals" : "Referral tracker"}</h2>
          </div>
          <label className="inline-filter">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ReferralStatus | "all")}>
              <option value="all">All statuses</option>
              {Object.entries(REFERRAL_STATUS_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <ReferralTable referrals={[...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))} />
      </section>
    </div>
  );
}
