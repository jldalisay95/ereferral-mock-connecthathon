import { FACILITIES } from "./facilities";
import { DEMO_PATIENTS } from "./patients";
import type {
  FacilityDefinition,
  PatientRecord,
  ReferralDraft
} from "../types";

export const CONSENT_STATEMENT =
  "Patient/representative consent was obtained for referral and data sharing for care coordination.";

export function createDemoDraft(
  referringFacility: FacilityDefinition = FACILITIES[0],
  receivingFacility: FacilityDefinition = FACILITIES[1],
  patientRecord: PatientRecord = DEMO_PATIENTS[0]
): ReferralDraft {
  const now = new Date().toISOString().slice(0, 16);
  return {
    referralId: `SYN-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`,
    patientRecordId: patientRecord.id,
    authoredOn: now,
    timeCalled: now,
    referringPractitioner: structuredClone(referringFacility.practitioner),
    receivingPractitioner: structuredClone(receivingFacility.practitioner),
    initiatingFacility: structuredClone(referringFacility.organization),
    receivingFacility: structuredClone(receivingFacility.organization),
    patient: structuredClone(patientRecord.patient),
    // Selectable coded values intentionally start empty. The UI fills these
    // only from successful live ValueSet expansions for the active preset.
    referralCategory: { system: "", code: "", display: "" },
    priority: "",
    requestedService: { system: "", code: "", display: "" },
    // The active IG permits a text-only clinical reason and does not bind this
    // project field to a required ValueSet.
    clinicalReason: { system: "", code: "", display: "" },
    referralNarrative:
      "Synthetic urgent referral for specialist assessment and higher-level monitoring.",
    remarks: "Please advise the patient and referring facility of the receiving response.",
    chiefComplaint: "Severe headache and dizziness for two days",
    clinicalHistory:
      "Synthetic history: symptoms persisted despite initial supportive care.",
    workingImpressionText: "Hypertensive disorder requiring specialist assessment",
    vitals: {
      observedAt: now,
      systolic: 170,
      diastolic: 105,
      heartRate: 108,
      respiratoryRate: 22,
      oxygenSaturation: 97,
      temperature: 37.1,
      weight: 68
    },
    treatment: "Synthetic treatment: rest, monitoring, and oral antihypertensive dose.",
    labTitle: "Synthetic urinalysis summary",
    labConclusion: "Synthetic result: protein detected; specialist review requested.",
    labAttachmentBase64: btoa("SYNTHETIC LAB RESULT - NOT FOR CLINICAL USE"),
    referralCriteriaSatisfied: false,
    consentGiven: false,
    consentStatement: CONSENT_STATEMENT,
    signatureBase64: btoa("synthetic-connectathon-signature")
  };
}
