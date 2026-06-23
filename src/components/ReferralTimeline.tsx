import type { ReferralTimelineEvent } from "../types";
import { StatusBadge } from "./StatusBadge";

interface ReferralTimelineProps {
  events: ReferralTimelineEvent[];
}

export function ReferralTimeline({ events }: ReferralTimelineProps) {
  return (
    <ol className="timeline">
      {[...events]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((event) => (
          <li key={event.id}>
            <span className="timeline-dot" />
            <div>
              <div className="timeline-heading">
                <StatusBadge status={event.status} />
                <time>{new Date(event.timestamp).toLocaleString()}</time>
              </div>
              <p>{event.note}</p>
              <small>{event.actorName}</small>
            </div>
          </li>
        ))}
    </ol>
  );
}
