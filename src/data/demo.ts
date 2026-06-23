import { FACILITIES } from "./facilities";
import type { FacilityDefinition, ReferralDraft } from "../types";

const address = {
  line: "123 Connectathon Road",
  barangay: "Poblacion",
  barangayCode: "0600407013",
  city: "Kalibo",
  cityCode: "0600407000",
  province: "Aklan",
  provinceCode: "0600400000",
  region: "Region VI (Western Visayas)",
  regionCode: "0600000000",
  postalCode: "5600"
};

export function createDemoDraft(
  referringFacility: FacilityDefinition = FACILITIES[0],
  receivingFacility: FacilityDefinition = FACILITIES[1]
): ReferralDraft {
  const now = new Date().toISOString().slice(0, 16);
  return {
    referralId: `SYN-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`,
    authoredOn: now,
    referringPractitioner: structuredClone(referringFacility.practitioner),
    receivingPractitioner: structuredClone(receivingFacility.practitioner),
    initiatingFacility: structuredClone(referringFacility.organization),
    receivingFacility: structuredClone(receivingFacility.organization),
    patient: {
      given: "Lina",
      middle: "Demo",
      family: "Dela Cruz",
      gender: "female",
      birthDate: "1992-04-18",
      philSysId: "SYN-1992-0418-0001",
      philHealthId: "SYN-PHIC-000001",
      phone: "+63-900-000-0001",
      address: { ...address, line: "789 Synthetic Street" },
      contactName: "Ramon Dela Cruz",
      contactRelationship: "SPS",
      contactPhone: "+63-900-000-0002",
      pwdEnabled: false,
      pwdId: "",
      disability: {
        system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
        code: "physical",
        display: "Physical/Orthopedic Disability"
      },
      pwdExpirationDate: ""
    },
    referralCategory: {
      system: "http://snomed.info/sct",
      code: "73770003",
      display: "Emergency"
    },
    serviceType: {
      system: "http://snomed.info/sct",
      code: "11429006",
      display: "Consultation"
    },
    referralNarrative:
      "Synthetic urgent referral for specialist assessment and higher-level monitoring.",
    chiefComplaint: "Severe headache and dizziness for two days",
    clinicalHistory:
      "Synthetic history: symptoms persisted despite initial supportive care.",
    workingImpressionText: "Hypertensive disorder requiring specialist assessment",
    workingImpression: {
      system: "http://snomed.info/sct",
      code: "38341003",
      display: "Hypertensive disorder"
    },
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
    signatureBase64: btoa("synthetic-connectathon-signature")
  };
}
