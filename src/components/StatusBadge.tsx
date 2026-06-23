import { REFERRAL_STATUS_LABELS } from "../services/referralRecords";
import type { ReferralStatus } from "../types";

interface StatusBadgeProps {
  status: ReferralStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{REFERRAL_STATUS_LABELS[status]}</span>;
}
