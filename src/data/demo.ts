import type { ReferralDraft } from "../types";

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

export function createDemoDraft(): ReferralDraft {
  const now = new Date().toISOString().slice(0, 16);
  return {
    referralId: `SYN-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`,
    authoredOn: now,
    referringPractitioner: {
      prefix: "Dr.",
      given: "Maya",
      family: "Santos",
      license: "SYN-PRC-10001",
      role: {
        system: "http://snomed.info/sct",
        code: "158965000",
        display: "Doctor"
      }
    },
    receivingPractitioner: {
      prefix: "Dr.",
      given: "Noel",
      family: "Cruz",
      license: "SYN-PRC-20002",
      role: {
        system: "http://snomed.info/sct",
        code: "158965000",
        display: "Doctor"
      }
    },
    initiatingFacility: {
      name: "Synthetic Kalibo Community Clinic",
      nhfrCode: "SYN-NHFR-3056",
      hcpnName: "Synthetic Aklan HCPN",
      phone: "+63-900-000-3056",
      address
    },
    receivingFacility: {
      name: "Synthetic Provincial Referral Hospital",
      nhfrCode: "SYN-NHFR-0513",
      hcpnName: "Synthetic Aklan HCPN",
      phone: "+63-900-000-0513",
      address: { ...address, line: "456 Referral Avenue" }
    },
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
