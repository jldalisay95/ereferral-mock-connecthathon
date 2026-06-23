import { buildReferralTransactionBundle } from "../fhir/builders";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import type {
  FacilityAccount,
  Notification,
  ReferralDraft,
  ReferralRecord,
  ReferralStatus,
  ReferralTimelineEvent
} from "../types";

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  submitted: "Submitted",
  requested: "Requested",
  received: "Received",
  accepted: "Accepted",
  rejected: "Rejected",
  "referred-onward": "Forwarded / Referred",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  error: "Error"
};

export function createTimelineEvent(
  referralId: string,
  status: ReferralStatus,
  note: string,
  account: FacilityAccount
): ReferralTimelineEvent {
  return {
    id: crypto.randomUUID(),
    referralId,
    status,
    label: REFERRAL_STATUS_LABELS[status],
    note,
    actorOrganizationId: account.organizationId,
    actorName: account.displayName,
    timestamp: new Date().toISOString()
  };
}

export function createDraftRecord(
  draft: ReferralDraft,
  account: FacilityAccount,
  receivingOrganizationId: string
): ReferralRecord {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    localReferralId: draft.referralId,
    patientName: `${draft.patient.given} ${draft.patient.family}`.trim(),
    referringOrganizationId: account.organizationId,
    referringOrganizationName: account.organizationName,
    receivingOrganizationId,
    receivingOrganizationName: draft.receivingFacility.name,
    reason: draft.serviceType.display,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    validationSummary: emptyValidationSummary(),
    fhirBundle: buildReferralTransactionBundle(draft),
    fhirResources: [],
    resourceReferences: {},
    draft,
    timeline: [createTimelineEvent(id, "draft", "Synthetic referral draft created.", account)],
    liveSubmission: false
  };
}

export function updateDraftRecord(
  record: ReferralRecord,
  draft: ReferralDraft,
  receivingOrganizationId: string
): ReferralRecord {
  return {
    ...record,
    localReferralId: draft.referralId,
    patientName: `${draft.patient.given} ${draft.patient.family}`.trim(),
    receivingOrganizationId,
    receivingOrganizationName: draft.receivingFacility.name,
    reason: draft.serviceType.display,
    updatedAt: new Date().toISOString(),
    draft,
    fhirBundle: buildReferralTransactionBundle(draft)
  };
}

export function referralsForAccount(
  referrals: ReferralRecord[],
  account: FacilityAccount | null
): ReferralRecord[] {
  if (!account) return [];
  if (account.role === "admin") return referrals;
  return referrals.filter((referral) =>
    account.role === "referring_facility_user"
      ? referral.referringOrganizationId === account.organizationId
      : referral.receivingOrganizationId === account.organizationId ||
        referral.forwardedToOrganizationId === account.organizationId
  );
}

export function notificationsForAccount(
  notifications: Notification[],
  account: FacilityAccount | null
): Notification[] {
  if (!account) return [];
  if (account.role === "admin") return notifications;
  return notifications.filter(
    (notification) => notification.receivingOrganizationId === account.organizationId
  );
}
