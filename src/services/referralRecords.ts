import { buildReferralTransactionBundle } from "../fhir/builders";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import { patientDisplayName } from "../data/patients";
import type {
  FacilityAccount,
  Notification,
  ReferralDraft,
  ReferralRecord,
  ReferralStatus,
  ReferralTimelineEvent,
  TimelineStatus
} from "../types";

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  submitted: "Submitted",
  requested: "Requested",
  received: "Received",
  accepted: "Accepted",
  rejected: "Rejected",
  "referred-onward": "Referred onward",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  error: "Error"
};

export const TIMELINE_STATUS_LABELS: Record<TimelineStatus, string> = {
  ...REFERRAL_STATUS_LABELS,
  "patient-assessed": "Patient assessed",
  "criteria-satisfied": "Referral criteria satisfied",
  "consent-obtained": "Consent obtained",
  arrived: "Arrived",
  admitted: "Admitted",
  "er-observation": "ER observation",
  "other-care": "Other care",
  discharged: "Discharged"
};

export function createTimelineEvent(
  referralId: string,
  status: TimelineStatus,
  note: string,
  account: FacilityAccount
): ReferralTimelineEvent {
  return {
    id: crypto.randomUUID(),
    referralId,
    status,
    label: TIMELINE_STATUS_LABELS[status],
    note,
    actorOrganizationId: account.organizationId,
    actorName: `${account.displayName} - ${account.organizationName}`,
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
    patientId: draft.patientRecordId,
    patientName: patientDisplayName(draft.patient),
    referringOrganizationId: account.organizationId,
    referringOrganizationName: account.organizationName,
    receivingOrganizationId,
    receivingOrganizationName: draft.receivingFacility.name,
    reason: draft.requestedService.display,
    priority: draft.priority,
    category: draft.referralCategory.display,
    consentGiven: draft.consentGiven,
    status: "draft",
    taskStatus: "draft",
    createdAt: now,
    updatedAt: now,
    validationSummary: emptyValidationSummary(),
    fhirBundle: buildReferralTransactionBundle(draft),
    fhirResources: [],
    resourceReferences: {},
    draft,
    timeline: [
      createTimelineEvent(id, "draft", "Local referral draft created.", account)
    ],
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
    patientId: draft.patientRecordId,
    patientName: patientDisplayName(draft.patient),
    receivingOrganizationId,
    receivingOrganizationName: draft.receivingFacility.name,
    reason: draft.requestedService.display,
    priority: draft.priority,
    category: draft.referralCategory.display,
    consentGiven: draft.consentGiven,
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
  return referrals.filter(
    (referral) =>
      referral.referringOrganizationId === account.organizationId ||
      referral.receivingOrganizationId === account.organizationId ||
      referral.forwardedToOrganizationId === account.organizationId
  );
}

export function sentReferralsForAccount(
  referrals: ReferralRecord[],
  account: FacilityAccount | null
) {
  if (!account) return [];
  if (account.role === "admin") return referrals;
  return referrals.filter(
    (referral) => referral.referringOrganizationId === account.organizationId
  );
}

export function incomingReferralsForAccount(
  referrals: ReferralRecord[],
  account: FacilityAccount | null
) {
  if (!account) return [];
  if (account.role === "admin") return referrals;
  return referrals.filter(
    (referral) => referral.receivingOrganizationId === account.organizationId
  );
}

export function notificationsForAccount(
  notifications: Notification[],
  account: FacilityAccount | null
): Notification[] {
  if (!account) return [];
  if (account.role === "admin") return notifications;
  return notifications.filter(
    (notification) => notification.targetOrganizationId === account.organizationId
  );
}
