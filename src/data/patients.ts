import { PSGC_VERSION, RELATIONSHIP_OPTIONS } from "../config/fhir";
import type { PatientInput, PatientRecord } from "../types";

export const EMPTY_ADDRESS = {
  line: "",
  barangay: "",
  barangayCode: "",
  city: "",
  cityCode: "",
  province: "",
  provinceCode: "",
  region: "",
  regionCode: "",
  postalCode: "",
  psgcVersion: PSGC_VERSION
};

export function createEmptyPatient(): PatientInput {
  return {
    given: "",
    middle: "",
    family: "",
    gender: "unknown",
    birthDate: "",
    philSysId: "",
    philHealthId: "",
    phone: "",
    address: { ...EMPTY_ADDRESS },
    contactName: "",
    contactRelationship: { ...RELATIONSHIP_OPTIONS[0] },
    contactPhone: "",
    pwdEnabled: false,
    pwdId: "",
    disabilities: [],
    pwdExpirationDate: ""
  };
}

const now = "2026-06-23T08:00:00.000Z";

export const DEMO_PATIENTS: PatientRecord[] = [
  {
    id: "patient-kalibo-lina",
    organizationId: "org-kalibo",
    registryType: "registered",
    patient: {
      ...createEmptyPatient(),
      given: "Lina",
      middle: "Demo",
      family: "Dela Cruz",
      gender: "female",
      birthDate: "1992-04-18",
      philSysId: "SYN-1992-0418-0001",
      philHealthId: "SYN-PHIC-000001",
      phone: "+63-900-000-0001",
      address: {
        line: "789 Synthetic Street",
        barangay: "Poblacion",
        barangayCode: "0600407013",
        city: "Kalibo",
        cityCode: "0600407000",
        province: "Aklan",
        provinceCode: "0600400000",
        region: "Region VI (Western Visayas)",
        regionCode: "0600000000",
        postalCode: "5600",
        psgcVersion: PSGC_VERSION
      },
      contactName: "Ramon Dela Cruz",
      contactRelationship: {
        system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
        code: "SPS",
        display: "spouse"
      },
      contactPhone: "+63-900-000-0002"
    },
    notes: "Synthetic Connectathon patient.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "patient-drstmh-ben",
    organizationId: "org-drstmh",
    registryType: "registered",
    patient: {
      ...createEmptyPatient(),
      given: "Benjamin",
      family: "Reyes",
      gender: "male",
      birthDate: "1984-09-10",
      philSysId: "SYN-1984-0910-0002",
      philHealthId: "SYN-PHIC-000002",
      phone: "+63-900-000-0010"
    },
    notes: "Synthetic Connectathon patient.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "patient-south-cotabato-ana",
    organizationId: "org-south-cotabato",
    registryType: "registered",
    patient: {
      ...createEmptyPatient(),
      given: "Ana",
      family: "Mendoza",
      gender: "female",
      birthDate: "1998-11-02",
      philSysId: "SYN-1998-1102-0003",
      philHealthId: "SYN-PHIC-000003",
      phone: "+63-900-000-0020"
    },
    notes: "Synthetic Connectathon patient.",
    createdAt: now,
    updatedAt: now
  }
];

export function patientDisplayName(patient: PatientInput) {
  return [patient.given, patient.middle, patient.family].filter(Boolean).join(" ").trim();
}
