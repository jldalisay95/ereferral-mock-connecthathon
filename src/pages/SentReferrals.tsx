import { ReferralTable } from "../components/ReferralTable";
import { useAppContext } from "../context/useAppContext";

export function SentReferrals() {
  const { sentReferrals } = useAppContext();
  return (
    <section className="card">
      <p className="eyebrow">Initiating facility</p>
      <h2>Sent Referrals</h2>
      <ReferralTable
        referrals={[...sentReferrals].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )}
        emptyMessage="This facility has not sent any referrals."
      />
    </section>
  );
}
