import type { CodingInput, EndpointConfig, RequestPriority } from "../types";

export type ConnectathonPresetName = "participant" | "ready";

export interface ConnectathonCapabilities {
  remoteReads: boolean;
  validation: boolean;
  localSimulation: boolean;
  externalWrites: boolean;
}

export interface ConformanceValueSet {
  key: string;
  label: string;
  canonical: string;
  fallbackOptions: readonly CodingInput[];
}

export interface ConnectathonConfig {
  preset: ConnectathonPresetName;
  ig: {
    name: string;
    version: string;
    fhirVersion: string;
    documentationUrl: string;
    profilesUrl: string;
    terminologyUrl: string;
    workflowUrl: string;
  };
  endpoints: EndpointConfig;
  capabilities: ConnectathonCapabilities;
  profiles: Record<string, string>;
  extensions: Record<string, string>;
  identifierSystems: Record<string, string>;
  codeSystems: {
    workflow: string;
    psgc: string;
  };
  psgc: {
    codeSystemId: string;
    version: string;
    valueSets: Record<"regions" | "provinces" | "cities" | "barangays" | "all", string>;
    valueSetIds: Record<"regions" | "provinces" | "cities" | "barangays" | "all", string>;
  };
  terminology: {
    referralCategories: readonly CodingInput[];
    requestedServices: readonly CodingInput[];
    clinicalReasons: readonly CodingInput[];
    relationships: readonly CodingInput[];
    disabilities: readonly CodingInput[];
    practitionerRoles: readonly CodingInput[];
    priorities: ReadonlyArray<{ code: RequestPriority; display: string }>;
    valueSets: readonly ConformanceValueSet[];
  };
  features: {
    includePsgcExtensions: boolean;
  };
}

export const PRESET_CAPABILITIES: Record<ConnectathonPresetName, ConnectathonCapabilities> = {
  participant: {
    remoteReads: true,
    validation: true,
    localSimulation: false,
    externalWrites: false
  },
  ready: {
    remoteReads: true,
    validation: true,
    localSimulation: true,
    externalWrites: true
  }
};

const coding = (system: string, code: string, display: string): CodingInput => ({
  system,
  code,
  display
});

// EDIT FOR YOUR FORK — active PHeRef/PH Core implementation guide and test servers.
// IG home: https://fhir.doh.gov.ph/pheref/
const EDITABLE_CONFORMANCE = {
  ig: {
    name: "Philippine Electronic Referral Implementation Guide",
    version: "connectathon-current",
    fhirVersion: "4.0.1",
    documentationUrl: "https://fhir.doh.gov.ph/pheref/",
    profilesUrl: "https://fhir.doh.gov.ph/pheref/artifacts.html#structures-resource-profiles",
    terminologyUrl: "https://fhir.doh.gov.ph/pheref/artifacts.html#terminology-value-sets",
    workflowUrl: "https://fhir.doh.gov.ph/pheref/"
  },
  endpoints: {
    pherefBaseUrl: "https://cdr.pheref.fhirlab.net/fhir",
    phCoreBaseUrl: "https://cdr.phcore.fhirlab.net/fhir",
    terminologyBaseUrl: "https://tx.fhirlab.net/fhir"
  },

  // EDIT FOR YOUR FORK — StructureDefinition canonicals used in resource.meta.profile.
  // IG profiles: https://fhir.doh.gov.ph/pheref/artifacts.html#structures-resource-profiles
  profiles: {
    patient: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-patient",
    practitioner: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-practitioner",
    practitionerRole: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-practitioner-role",
    organization: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-organization",
    encounter: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-encounter",
    condition: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-condition",
    observation: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-observation",
    procedure: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-procedure",
    serviceRequest: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-service-request",
    task: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-task",
    provenance: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-provenance",
    pwdDisability: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-pwd-disability"
  },

  // EDIT FOR YOUR FORK — extension and identifier system canonicals.
  // PH Core artifacts: https://fhir.doh.gov.ph/phcore/artifacts.html
  extensions: {
    region: "https://fhir.doh.gov.ph/phcore/StructureDefinition/region",
    province: "https://fhir.doh.gov.ph/phcore/StructureDefinition/province",
    cityMunicipality: "https://fhir.doh.gov.ph/phcore/StructureDefinition/city-municipality",
    barangay: "https://fhir.doh.gov.ph/phcore/StructureDefinition/barangay"
  },
  identifierSystems: {
    philHealth: "http://philhealth.gov.ph/fhir/Identifier/philhealth-id",
    philSys: "http://philsys.gov.ph/fhir/Identifier/philsys-id",
    nhfr: "https://fhir.doh.gov.ph/phcore/Identifier/doh-nhfr-code",
    hcpn: "https://fhir.doh.gov.ph/phcore/Identifier/hcpn-code",
    prc: "https://fhir.doh.gov.ph/phcore/Identifier/doh-prc-license-number",
    referral: "https://fhir.doh.gov.ph/pheref/Identifier/referral-id"
  },
  codeSystems: {
    workflow: "https://fhir.doh.gov.ph/pheref/CodeSystem/ereferral-workflow",
    psgc: "https://psa.gov.ph/classification/psgc"
  },

  // EDIT FOR YOUR FORK — PSGC release and ValueSets published by the active terminology server.
  // Terminology artifacts: https://fhir.doh.gov.ph/phcore/artifacts.html#terminology-value-sets
  psgc: {
    codeSystemId: "PSGC",
    version: "1Q-2026",
    valueSets: {
      regions: "https://fhir.doh.gov.ph/phcore/ValueSet/regions",
      provinces: "https://fhir.doh.gov.ph/phcore/ValueSet/provinces",
      cities: "https://fhir.doh.gov.ph/phcore/ValueSet/cities",
      barangays: "https://fhir.doh.gov.ph/phcore/ValueSet/barangays",
      all: "https://fhir.doh.gov.ph/phcore/ValueSet/psgc"
    },
    valueSetIds: {
      regions: "regions",
      provinces: "provinces",
      cities: "cities",
      barangays: "barangays",
      all: "psgc"
    }
  },
  features: {
    // Enable only when the active validator accepts the configured PSGC CodeSystem/version.
    includePsgcExtensions: false
  }
} as const;

// EDIT FOR YOUR FORK — fallback terminology keeps form development usable, but
// readiness requires successful live ValueSet expansion from the configured server.
const REFERRAL_CATEGORY_OPTIONS = [
  coding("http://snomed.info/sct", "73770003", "Emergency"),
  coding("http://snomed.info/sct", "440655000", "Outpatient environment")
] as const;

const REQUESTED_SERVICE_OPTIONS = [
  coding("http://snomed.info/sct", "11429006", "Consultation"),
  coding("http://snomed.info/sct", "165197003", "Diagnostic assessment"),
  coding("http://snomed.info/sct", "71388002", "Procedure"),
  coding("http://snomed.info/sct", "3457005", "Others")
] as const;

const CLINICAL_REASON_OPTIONS = [
  coding("http://snomed.info/sct", "267036007", "Dyspnea"),
  coding("http://snomed.info/sct", "29857009", "Chest pain"),
  coding("http://snomed.info/sct", "414545008", "Suspected lung cancer"),
  coding("http://snomed.info/sct", "42343007", "Congestive heart failure"),
  coding("http://snomed.info/sct", "49436004", "Atrial fibrillation"),
  coding("http://snomed.info/sct", "59621000", "Essential hypertension"),
  coding("http://snomed.info/sct", "73211009", "Diabetes mellitus"),
  coding("http://snomed.info/sct", "109006", "Anxiety disorder")
] as const;

const RELATIONSHIP_OPTIONS = [
  coding("http://terminology.hl7.org/CodeSystem/v2-0131", "N", "Next-of-Kin"),
  coding("http://terminology.hl7.org/CodeSystem/v2-0131", "C", "Emergency Contact"),
  coding("http://terminology.hl7.org/CodeSystem/v2-0131", "E", "Employer"),
  coding("http://terminology.hl7.org/CodeSystem/v2-0131", "I", "Insurance Company"),
  coding("http://terminology.hl7.org/CodeSystem/v2-0131", "U", "Unknown")
] as const;

const PWD_DISABILITY_OPTIONS = [
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "visual", "Visual Disability"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "hearing", "Hearing Disability"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "speech", "Speech Impairment"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "physical", "Physical/Orthopedic Disability"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "intellectual", "Intellectual Disability"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "learning", "Learning Disability"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "psychosocial", "Psychosocial Disability"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "visual-low-vision", "Low Vision"),
  coding("https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", "visual-blindness", "Blindness")
] as const;

const PRACTITIONER_ROLE_OPTIONS = [
  coding("http://snomed.info/sct", "158965000", "Doctor"),
  coding("http://snomed.info/sct", "265937000", "Nurse"),
  coding("http://snomed.info/sct", "309453006", "Midwife"),
  coding("http://snomed.info/sct", "46255001", "Pharmacist"),
  coding("http://snomed.info/sct", "386629007", "Medical Technologist"),
  coding("http://snomed.info/sct", "159282002", "Laboratory Aide"),
  coding("http://snomed.info/sct", "106289002", "Dentist"),
  coding("http://snomed.info/sct", "4162009", "Dental Aide"),
  coding("http://snomed.info/sct", "28229004", "Optometrist"),
  coding("https://fhir.doh.gov.ph/phcore/CodeSystem/PSOC", "3253", "Barangay Health Worker"),
  coding("https://fhir.doh.gov.ph/phcore/CodeSystem/PHCW", "PCW", "Primary Care Worker")
] as const;

const REFERRAL_PRIORITY_OPTIONS: ReadonlyArray<{ code: RequestPriority; display: string }> = [
  { code: "routine", display: "Routine" },
  { code: "urgent", display: "Urgent" },
  { code: "stat", display: "STAT" }
];

// EDIT FOR YOUR FORK — project/IG ValueSet canonicals and fallback codes.
const PROJECT_VALUE_SETS: readonly ConformanceValueSet[] = [
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
  }
];

// STANDARD FHIR CONSTANTS — do not edit for a Connectathon fork.
const STANDARD_FHIR_VALUE_SETS: readonly ConformanceValueSet[] = [
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
      coding("http://hl7.org/fhir/task-status", "entered-in-error", "Entered in Error")
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
];

const VALUE_SETS = [
  ...PROJECT_VALUE_SETS,
  ...STANDARD_FHIR_VALUE_SETS
] satisfies readonly ConformanceValueSet[];

const requestedPreset = import.meta.env.VITE_CONNECTATHON_PRESET;
export const CONNECTATHON_PRESET: ConnectathonPresetName =
  requestedPreset === "participant" || requestedPreset === "ready"
    ? requestedPreset
    : import.meta.env.MODE === "ready" || import.meta.env.MODE === "test"
      ? "ready"
      : "participant";

export const CONNECTATHON_CONFIG: ConnectathonConfig = {
  ...EDITABLE_CONFORMANCE,
  preset: CONNECTATHON_PRESET,
  endpoints: {
    pherefBaseUrl: import.meta.env.VITE_PHEREF_BASE_URL ?? EDITABLE_CONFORMANCE.endpoints.pherefBaseUrl,
    phCoreBaseUrl: import.meta.env.VITE_PHCORE_BASE_URL ?? EDITABLE_CONFORMANCE.endpoints.phCoreBaseUrl,
    terminologyBaseUrl: import.meta.env.VITE_TX_BASE_URL ?? EDITABLE_CONFORMANCE.endpoints.terminologyBaseUrl,
    demoMode: CONNECTATHON_PRESET !== "ready"
  },
  capabilities: PRESET_CAPABILITIES[CONNECTATHON_PRESET],
  terminology: {
    referralCategories: REFERRAL_CATEGORY_OPTIONS,
    requestedServices: REQUESTED_SERVICE_OPTIONS,
    clinicalReasons: CLINICAL_REASON_OPTIONS,
    relationships: RELATIONSHIP_OPTIONS,
    disabilities: PWD_DISABILITY_OPTIONS,
    practitionerRoles: PRACTITIONER_ROLE_OPTIONS,
    priorities: REFERRAL_PRIORITY_OPTIONS,
    valueSets: VALUE_SETS
  }
};

export function assertExternalWritesAllowed(
  config: Pick<ConnectathonConfig, "preset" | "capabilities"> = CONNECTATHON_CONFIG
): void {
  if (!config.capabilities.externalWrites) {
    throw new Error(
      `External FHIR writes are disabled by the ${config.preset} preset. Complete the Connectathon Guide checks, then run the ready preset explicitly.`
    );
  }
}
