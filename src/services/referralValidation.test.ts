import { describe, expect, it } from "vitest";
import { createDemoDraft } from "../data/demo";
import {
  assertReferralSubmissionReady,
  getReferralSubmissionMissing
} from "./referralValidation";

describe("referral submission requirements", () => {
  it("blocks criteria, consent, and incomplete walk-in demographics", () => {
    const draft = createDemoDraft();
    draft.patient.birthDate = "";
    draft.patient.gender = "unknown";
    expect(getReferralSubmissionMissing(draft)).toEqual(
      expect.arrayContaining([
        "Referral criteria decision",
        "Referral consent",
        "Patient birth date",
        "Known administrative gender"
      ])
    );
    expect(() => assertReferralSubmissionReady(draft)).toThrow(
      /complete required fields/i
    );
  });

  it("accepts a complete referral draft", () => {
    const draft = createDemoDraft();
    draft.referralCriteriaSatisfied = true;
    draft.consentGiven = true;
    expect(getReferralSubmissionMissing(draft)).toEqual([]);
    expect(() => assertReferralSubmissionReady(draft)).not.toThrow();
  });

  it("blocks future referral and time-called values", () => {
    const draft = createDemoDraft();
    draft.referralCriteriaSatisfied = true;
    draft.consentGiven = true;
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    draft.authoredOn = future;
    draft.timeCalled = future;
    expect(getReferralSubmissionMissing(draft)).toEqual(
      expect.arrayContaining([
        "Referral date/time must not be in the future",
        "Time called must not be in the future"
      ])
    );
  });

  it("accepts a receiving Organization selected by FHIR reference", () => {
    const draft = createDemoDraft();
    draft.referralCriteriaSatisfied = true;
    draft.consentGiven = true;
    draft.receivingFacility.nhfrCode = "";
    draft.receivingFacility.fhirReference =
      "https://cdr.pheref.fhirlab.net/fhir/Organization/123";
    draft.receivingPractitioner = undefined;
    expect(getReferralSubmissionMissing(draft)).toEqual([]);
  });
});
