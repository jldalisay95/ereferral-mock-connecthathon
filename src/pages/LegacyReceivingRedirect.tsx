import { Navigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import { ReceivingFacilityView } from "./ReceivingFacilityView";

export function LegacyReceivingRedirect() {
  const { taskId } = useParams();
  const { scopedReferrals } = useAppContext();
  const referral = scopedReferrals.find(
    (item) => item.resourceReferences.taskReference === `Task/${taskId}`
  );
  return referral
    ? <Navigate to={`/referrals/${referral.id}`} replace />
    : <ReceivingFacilityView />;
}
