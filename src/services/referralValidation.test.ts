import { describe, expect, it } from "vitest";
import { createDemoDraft } from "../data/demo";
import {
  assertNonBlockingValidation,
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

  it("requires a completed, non-blocking validation before ready submission", () => {
    const summary = {
      counts: { fatal: 0, error: 0, warning: 0, information: 0 },
      fatalCount: 0,
      errorCount: 0,
      warningCount: 0,
      informationCount: 0,
      issues: [],
      blocking: false,
      validated: false
    };

    expect(() => assertNonBlockingValidation(summary)).toThrow(/\$validate/i);
    expect(() =>
      assertNonBlockingValidation({ ...summary, validated: true, blocking: true })
    ).toThrow(/non-blocking/i);
    expect(() =>
      assertNonBlockingValidation({ ...summary, validated: true })
    ).not.toThrow();
  });
});
