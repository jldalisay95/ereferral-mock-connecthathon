import type { EndpointConfig } from "../types";

export const DEFAULT_ENDPOINTS: EndpointConfig = {
  pherefBaseUrl:
    import.meta.env.VITE_PHEREF_BASE_URL ?? "https://cdr.pheref.fhirlab.net/fhir",
  phCoreBaseUrl:
    import.meta.env.VITE_PHCORE_BASE_URL ?? "https://cdr.phcore.fhirlab.net/fhir",
  terminologyBaseUrl:
    import.meta.env.VITE_TX_BASE_URL ?? "https://tx.fhirlab.net/fhir",
  demoMode: true
};

export const PROFILES = {
  patient: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-patient",
  practitioner: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-practitioner",
  practitionerRole:
    "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-practitioner-role",
  organization: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-organization",
  encounter: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-encounter",
  condition: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-condition",
  observation: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-observation",
  procedure: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-procedure",
  serviceRequest:
    "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-service-request",
  task: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-task",
  provenance: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-provenance",
  pwdDisability:
    "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-pwd-disability"
} as const;

export const IDENTIFIER_SYSTEMS = {
  philHealth: "http://philhealth.gov.ph/fhir/Identifier/philhealth-id",
  philSys: "http://philsys.gov.ph/fhir/Identifier/philsys-id",
  nhfr: "https://fhir.doh.gov.ph/phcore/Identifier/doh-nhfr-code",
  hcpn: "https://fhir.doh.gov.ph/phcore/Identifier/hcpn-code",
  prc: "https://fhir.doh.gov.ph/phcore/Identifier/doh-prc-license-number",
  referral: "https://fhir.doh.gov.ph/pheref/Identifier/referral-id"
} as const;

export const VALUE_SETS = [
  {
    key: "practitioner-role",
    label: "Practitioner Role",
    canonical: "https://www.fhir.doh.gov.ph/pheref/ValueSet/practitioner-role"
  },
  {
    key: "referral-category",
    label: "Referral Category",
    canonical: "https://www.fhir.doh.gov.ph/pheref/ValueSet/referral-category"
  },
  {
    key: "reason-for-referral",
    label: "Reason for Referral / Service Type",
    canonical:
      "https://www.fhir.doh.gov.ph/pheref/ValueSet/reason-for-referral-service-type"
  },
  {
    key: "pwd-disability",
    label: "PWD Disability Type",
    canonical: "https://fhir.doh.gov.ph/pheref/ValueSet/pwd-disability-type-vs"
  },
  {
    key: "administrative-gender",
    label: "Administrative Gender",
    canonical: "http://hl7.org/fhir/ValueSet/administrative-gender"
  },
  {
    key: "task-status",
    label: "Task Status",
    canonical: "http://hl7.org/fhir/ValueSet/task-status"
  },
  {
    key: "contact-point-system",
    label: "Contact Point System",
    canonical: "http://hl7.org/fhir/ValueSet/contact-point-system"
  },
  {
    key: "contact-point-use",
    label: "Contact Point Use",
    canonical: "http://hl7.org/fhir/ValueSet/contact-point-use"
  }
] as const;
