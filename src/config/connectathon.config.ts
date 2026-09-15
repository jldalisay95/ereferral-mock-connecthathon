import type { EndpointConfig } from "../types";

export type ConnectathonPresetName = "participant" | "ready";

export type ValueSetEndpointKey = Exclude<keyof EndpointConfig, "demoMode">;

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
  endpoint: ValueSetEndpointKey;
}

export function resolveValueSetEndpoint(
  valueSet: Pick<ConformanceValueSet, "endpoint">,
  endpoints: EndpointConfig
): string {
  return endpoints[valueSet.endpoint];
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
    psgc: string;
  };
  psgc: {
    codeSystemId: string;
    version: string;
    valueSets: Record<"regions" | "provinces" | "cities" | "barangays" | "all", string>;
    valueSetIds: Record<"regions" | "provinces" | "cities" | "barangays" | "all", string>;
  };
  terminology: {
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

// EDIT FOR YOUR FORK — project/IG ValueSet canonicals and expansion endpoints.
// Every coded option is loaded live; no local terminology fallback is used.
const PROJECT_VALUE_SETS: readonly ConformanceValueSet[] = [
  {
    key: "practitioner-role",
    label: "Practitioner Role",
    canonical: "https://www.fhir.doh.gov.ph/pheref/ValueSet/practitioner-role",
    endpoint: "terminologyBaseUrl"
  },
  {
    key: "referral-category",
    label: "Referral Category",
    canonical: "https://www.fhir.doh.gov.ph/pheref/ValueSet/referral-category",
    endpoint: "terminologyBaseUrl"
  },
  {
    key: "reason-for-referral-service-type",
    label: "Reason for Referral / Service Type",
    canonical:
      "https://www.fhir.doh.gov.ph/pheref/ValueSet/reason-for-referral-service-type",
    endpoint: "terminologyBaseUrl"
  },
  {
    key: "pwd-disability",
    label: "PWD Disability Type",
    canonical: "https://fhir.doh.gov.ph/pheref/ValueSet/pwd-disability-type-vs",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "ereferral-relationship-type",
    label: "eReferral Relationship Type",
    canonical: "https://fhir.doh.gov.ph/pheref/ValueSet/ereferral-relationship-type",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "ereferral-receiving-response",
    label: "eReferral Receiving Facility Response",
    canonical: "https://fhir.doh.gov.ph/pheref/ValueSet/ereferral-receiving-response",
    endpoint: "pherefBaseUrl"
  }
];

// STANDARD FHIR CONSTANTS. Keep canonical URLs fixed; endpoint selects which
// configured server performs the read-only ValueSet/$expand operation.
const STANDARD_FHIR_VALUE_SETS: readonly ConformanceValueSet[] = [
  {
    key: "patient-contact-relationship",
    label: "Patient Contact Relationship",
    canonical: "http://hl7.org/fhir/ValueSet/patient-contactrelationship",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "administrative-gender",
    label: "Administrative Gender",
    canonical: "http://hl7.org/fhir/ValueSet/administrative-gender",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "request-priority",
    label: "Request Priority",
    canonical: "http://hl7.org/fhir/ValueSet/request-priority",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "task-status",
    label: "Task Status",
    canonical: "http://hl7.org/fhir/ValueSet/task-status",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "contact-point-system",
    label: "Contact Point System",
    canonical: "http://hl7.org/fhir/ValueSet/contact-point-system",
    endpoint: "pherefBaseUrl"
  },
  {
    key: "contact-point-use",
    label: "Contact Point Use",
    canonical: "http://hl7.org/fhir/ValueSet/contact-point-use",
    endpoint: "pherefBaseUrl"
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
