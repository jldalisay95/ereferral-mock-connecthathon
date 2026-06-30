import type { ReferralDraft } from "../types";

function isFutureDateTime(value: string) {
  if (!value) return false;
  const date = new Date(value.includes("T") && !value.endsWith("Z") ? `${value}:00` : value);
  return !Number.isNaN(date.getTime()) && date > new Date();
}

export function getReferralSubmissionMissing(draft: ReferralDraft): string[] {
  return [
    !draft.referralCriteriaSatisfied && "Referral criteria decision",
    !draft.consentGiven && "Referral consent",
    !draft.patient.given && "Patient given name",
    !draft.patient.family && "Patient family name",
    !draft.patient.birthDate && "Patient birth date",
    draft.patient.gender === "unknown" && "Known administrative gender",
    !draft.initiatingFacility.nhfrCode && "Initiating facility NHFR code",
    !draft.receivingFacility.nhfrCode &&
      !draft.receivingFacility.fhirReference &&
      "Receiving facility identifier or FHIR reference",
    !draft.requestedService.code && "Requested service code",
    !draft.clinicalReason.code && "Clinical reason code",
    !draft.chiefComplaint && "Chief complaint",
    !draft.workingImpressionText && "Working impression",
    isFutureDateTime(draft.authoredOn) && "Referral date/time must not be in the future",
    isFutureDateTime(draft.timeCalled) && "Time called must not be in the future",
    draft.patient.pwdEnabled &&
      !draft.patient.disabilities.length &&
      "PWD disability type"
  ].filter(Boolean) as string[];
}

export function assertReferralSubmissionReady(draft: ReferralDraft) {
  const missing = getReferralSubmissionMissing(draft);
  if (missing.length) {
    throw new Error(`Complete required fields: ${missing.join(", ")}.`);
  }
}
