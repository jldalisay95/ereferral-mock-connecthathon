import { TIMELINE_STATUS_LABELS } from "../services/referralRecords";
import type { TimelineStatus } from "../types";

interface StatusBadgeProps {
  status: TimelineStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${status}`}>
      {TIMELINE_STATUS_LABELS[status]}
    </span>
  );
}
