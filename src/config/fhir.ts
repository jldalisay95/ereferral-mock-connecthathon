import type { CodingInput, EndpointConfig, RequestPriority } from "../types";

export const DEFAULT_ENDPOINTS: EndpointConfig = {
  pherefBaseUrl:
    import.meta.env.VITE_PHEREF_BASE_URL ?? "https://cdr.pheref.fhirlab.net/fhir",
  phCoreBaseUrl:
    import.meta.env.VITE_PHCORE_BASE_URL ?? "https://cdr.phcore.fhirlab.net/fhir",
  terminologyBaseUrl:
    import.meta.env.VITE_TX_BASE_URL ?? "https://tx.fhirlab.net/fhir",
  demoMode: false
};

export const PROFILES = {
  patient: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-patient",
  practitioner: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-practitioner",
  practitionerRole:
    "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-practitioner-role",
  organization: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-organization",
  encounter: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-encounter",
  condition: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-condition",
  observation: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-observation",
  procedure: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-procedure",
  serviceRequest:
    "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-service-request",
  task: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-task",
  provenance: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-provenance",
  pwdDisability:
    "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-pwd-disability"
} as const;

export const IDENTIFIER_SYSTEMS = {
  philHealth: "http://philhealth.gov.ph/fhir/Identifier/philhealth-id",
  philSys: "http://philsys.gov.ph/fhir/Identifier/philsys-id",
  nhfr: "https://fhir.doh.gov.ph/phcore/Identifier/doh-nhfr-code",
  hcpn: "https://fhir.doh.gov.ph/phcore/Identifier/hcpn-code",
  prc: "https://fhir.doh.gov.ph/phcore/Identifier/doh-prc-license-number",
  referral: "https://fhir.doh.gov.ph/pheref/Identifier/referral-id"
} as const;

export const PSGC_SYSTEM = "https://psa.gov.ph/classification/psgc";
export const PSGC_CODE_SYSTEM_ID = "PSGC";
export const PSGC_VERSION = "1Q-2026";

export const PSGC_VALUE_SETS = {
  regions: "https://fhir.doh.gov.ph/phcore/ValueSet/regions",
  provinces: "https://fhir.doh.gov.ph/phcore/ValueSet/provinces",
  cities: "https://fhir.doh.gov.ph/phcore/ValueSet/cities",
  barangays: "https://fhir.doh.gov.ph/phcore/ValueSet/barangays",
  all: "https://fhir.doh.gov.ph/phcore/ValueSet/psgc"
} as const;

export const PSGC_VALUE_SET_IDS = {
  regions: "regions",
  provinces: "provinces",
  cities: "cities",
  barangays: "barangays",
  all: "psgc"
} as const;

export const REFERRAL_CATEGORY_OPTIONS = [
  {
    system: "http://snomed.info/sct",
    code: "73770003",
    display: "Emergency"
  },
  {
    system: "http://snomed.info/sct",
    code: "440655000",
    display: "Outpatient environment"
  }
] as const;

export const REQUESTED_SERVICE_OPTIONS = [
  {
    system: "http://snomed.info/sct",
    code: "11429006",
    display: "Consultation"
  },
  {
    system: "http://snomed.info/sct",
    code: "165197003",
    display: "Diagnostic assessment"
  },
  {
    system: "http://snomed.info/sct",
    code: "71388002",
    display: "Procedure"
  },
  {
    system: "http://snomed.info/sct",
    code: "3457005",
    display: "Others"
  }
] as const;

export const REFERRAL_PRIORITY_OPTIONS: ReadonlyArray<{
  code: RequestPriority;
  display: string;
}> = [
  { code: "routine", display: "Routine" },
  { code: "urgent", display: "Urgent" },
  { code: "stat", display: "STAT" }
];

export const CLINICAL_REASON_OPTIONS: readonly CodingInput[] = [
  { system: "http://snomed.info/sct", code: "267036007", display: "Dyspnea" },
  { system: "http://snomed.info/sct", code: "29857009", display: "Chest pain" },
  {
    system: "http://snomed.info/sct",
    code: "414545008",
    display: "Suspected lung cancer"
  },
  {
    system: "http://snomed.info/sct",
    code: "42343007",
    display: "Congestive heart failure"
  },
  {
    system: "http://snomed.info/sct",
    code: "49436004",
    display: "Atrial fibrillation"
  },
  {
    system: "http://snomed.info/sct",
    code: "59621000",
    display: "Essential hypertension"
  },
  {
    system: "http://snomed.info/sct",
    code: "73211009",
    display: "Diabetes mellitus"
  },
  {
    system: "http://snomed.info/sct",
    code: "109006",
    display: "Anxiety disorder"
  }
];

export const RELATIONSHIP_OPTIONS: readonly CodingInput[] = [
  {
    system: "http://terminology.hl7.org/CodeSystem/v2-0131",
    code: "N",
    display: "Next-of-Kin"
  },
  {
    system: "http://terminology.hl7.org/CodeSystem/v2-0131",
    code: "C",
    display: "Emergency Contact"
  },
  {
    system: "http://terminology.hl7.org/CodeSystem/v2-0131",
    code: "E",
    display: "Employer"
  },
  {
    system: "http://terminology.hl7.org/CodeSystem/v2-0131",
    code: "I",
    display: "Insurance Company"
  },
  {
    system: "http://terminology.hl7.org/CodeSystem/v2-0131",
    code: "U",
    display: "Unknown"
  },
];

export const PWD_DISABILITY_OPTIONS: readonly CodingInput[] = [
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "visual",
    display: "Visual Disability"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "hearing",
    display: "Hearing Disability"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "speech",
    display: "Speech Impairment"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "physical",
    display: "Physical/Orthopedic Disability"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "intellectual",
    display: "Intellectual Disability"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "learning",
    display: "Learning Disability"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "psychosocial",
    display: "Psychosocial Disability"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "visual-low-vision",
    display: "Low Vision"
  },
  {
    system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
    code: "visual-blindness",
    display: "Blindness"
  }
];

const PRACTITIONER_ROLE_OPTIONS: readonly CodingInput[] = [
  { system: "http://snomed.info/sct", code: "158965000", display: "Doctor" },
  { system: "http://snomed.info/sct", code: "265937000", display: "Nurse" },
  { system: "http://snomed.info/sct", code: "309453006", display: "Midwife" },
  { system: "http://snomed.info/sct", code: "46255001", display: "Pharmacist" },
  {
    system: "http://snomed.info/sct",
    code: "386629007",
    display: "Medical Technologist"
  },
  {
    system: "http://snomed.info/sct",
    code: "159282002",
    display: "Laboratory Aide"
  },
  { system: "http://snomed.info/sct", code: "106289002", display: "Dentist" },
  {
    system: "http://snomed.info/sct",
    code: "4162009",
    display: "Dental Aide"
  },
  {
    system: "http://snomed.info/sct",
    code: "28229004",
    display: "Optometrist"
  },
  {
    system: "https://fhir.doh.gov.ph/phcore/CodeSystem/PSOC",
    code: "3253",
    display: "Barangay Health Worker"
  },
  {
    system: "https://fhir.doh.gov.ph/phcore/CodeSystem/PHCW",
    code: "PCW",
    display: "Primary Care Worker"
  }
];

const coding = (system: string, code: string, display: string): CodingInput => ({
  system,
  code,
  display
});

export const VALUE_SETS = [
  {
    key: "practitioner-role",
    label: "Practitioner Role",
    canonical: "https://www.fhir.doh.gov.ph/pheref/ValueSet/practitioner-role",
    fallbackOptions: PRACTITIONER_ROLE_OPTIONS
  },
  {
    key: "referral-category",
    label: "Referral Category",
    canonical: "https://www.fhir.doh.gov.ph/pheref/ValueSet/referral-category",
    fallbackOptions: REFERRAL_CATEGORY_OPTIONS
  },
  {
    key: "reason-for-referral-service-type",
    label: "Reason for Referral / Service Type",
    canonical:
      "https://www.fhir.doh.gov.ph/pheref/ValueSet/reason-for-referral-service-type",
    fallbackOptions: REQUESTED_SERVICE_OPTIONS
  },
  {
    key: "pwd-disability",
    label: "PWD Disability Type",
    canonical: "https://fhir.doh.gov.ph/pheref/ValueSet/pwd-disability-type-vs",
    fallbackOptions: PWD_DISABILITY_OPTIONS
  },
  {
    key: "administrative-gender",
    label: "Administrative Gender",
    canonical: "http://hl7.org/fhir/ValueSet/administrative-gender",
    fallbackOptions: [
      coding("http://hl7.org/fhir/administrative-gender", "male", "Male"),
      coding("http://hl7.org/fhir/administrative-gender", "female", "Female"),
      coding("http://hl7.org/fhir/administrative-gender", "other", "Other"),
      coding("http://hl7.org/fhir/administrative-gender", "unknown", "Unknown")
    ]
  },
  {
    key: "task-status",
    label: "Task Status",
    canonical: "http://hl7.org/fhir/ValueSet/task-status",
    fallbackOptions: [
      coding("http://hl7.org/fhir/task-status", "draft", "Draft"),
      coding("http://hl7.org/fhir/task-status", "requested", "Requested"),
      coding("http://hl7.org/fhir/task-status", "received", "Received"),
      coding("http://hl7.org/fhir/task-status", "accepted", "Accepted"),
      coding("http://hl7.org/fhir/task-status", "rejected", "Rejected"),
      coding("http://hl7.org/fhir/task-status", "ready", "Ready"),
      coding("http://hl7.org/fhir/task-status", "cancelled", "Cancelled"),
      coding("http://hl7.org/fhir/task-status", "in-progress", "In Progress"),
      coding("http://hl7.org/fhir/task-status", "on-hold", "On Hold"),
      coding("http://hl7.org/fhir/task-status", "failed", "Failed"),
      coding("http://hl7.org/fhir/task-status", "completed", "Completed"),
      coding(
        "http://hl7.org/fhir/task-status",
        "entered-in-error",
        "Entered in Error"
      )
    ]
  },
  {
    key: "contact-point-system",
    label: "Contact Point System",
    canonical: "http://hl7.org/fhir/ValueSet/contact-point-system",
    fallbackOptions: [
      coding("http://hl7.org/fhir/contact-point-system", "phone", "Phone"),
      coding("http://hl7.org/fhir/contact-point-system", "fax", "Fax"),
      coding("http://hl7.org/fhir/contact-point-system", "email", "Email"),
      coding("http://hl7.org/fhir/contact-point-system", "pager", "Pager"),
      coding("http://hl7.org/fhir/contact-point-system", "url", "URL"),
      coding("http://hl7.org/fhir/contact-point-system", "sms", "SMS"),
      coding("http://hl7.org/fhir/contact-point-system", "other", "Other")
    ]
  },
  {
    key: "contact-point-use",
    label: "Contact Point Use",
    canonical: "http://hl7.org/fhir/ValueSet/contact-point-use",
    fallbackOptions: [
      coding("http://hl7.org/fhir/contact-point-use", "home", "Home"),
      coding("http://hl7.org/fhir/contact-point-use", "work", "Work"),
      coding("http://hl7.org/fhir/contact-point-use", "temp", "Temporary"),
      coding("http://hl7.org/fhir/contact-point-use", "old", "Old"),
      coding("http://hl7.org/fhir/contact-point-use", "mobile", "Mobile")
    ]
  }
] as const;
