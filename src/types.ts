export type FhirResource = {
  resourceType: string;
  id?: string;
  meta?: { profile?: string[]; versionId?: string; lastUpdated?: string };
  [key: string]: unknown;
};

export interface CodingInput {
  system: string;
  code: string;
  display: string;
  manual?: boolean;
}

export interface PersonInput {
  prefix?: string;
  given: string;
  family: string;
  license: string;
  role: CodingInput;
}

export interface AddressInput {
  line: string;
  barangay: string;
  barangayCode: string;
  city: string;
  cityCode: string;
  province: string;
  provinceCode: string;
  region: string;
  regionCode: string;
  postalCode: string;
}

export interface OrganizationInput {
  name: string;
  nhfrCode: string;
  hcpnName: string;
  phone: string;
  address: AddressInput;
}

export interface PatientInput {
  given: string;
  middle: string;
  family: string;
  gender: "male" | "female" | "other" | "unknown";
  birthDate: string;
  philSysId: string;
  philHealthId: string;
  phone: string;
  address: AddressInput;
  contactName: string;
  contactRelationship: string;
  contactPhone: string;
  pwdEnabled: boolean;
  pwdId: string;
  disability: CodingInput;
  pwdExpirationDate: string;
}

export interface ReferralDraft {
  referralId: string;
  authoredOn: string;
  referringPractitioner: PersonInput;
  receivingPractitioner: PersonInput;
  initiatingFacility: OrganizationInput;
  receivingFacility: OrganizationInput;
  patient: PatientInput;
  referralCategory: CodingInput;
  serviceType: CodingInput;
  referralNarrative: string;
  chiefComplaint: string;
  clinicalHistory: string;
  workingImpressionText: string;
  workingImpression: CodingInput;
  vitals: {
    observedAt: string;
    systolic: number;
    diastolic: number;
    heartRate: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    temperature: number;
    weight: number;
  };
  treatment: string;
  labTitle: string;
  labConclusion: string;
  labAttachmentBase64: string;
  signatureBase64: string;
}

export interface EndpointConfig {
  pherefBaseUrl: string;
  phCoreBaseUrl: string;
  terminologyBaseUrl: string;
}

export interface ValidationIssue {
  severity: "fatal" | "error" | "warning" | "information";
  code?: string;
  message: string;
  expression?: string[];
  category: "structural" | "terminology" | "capability" | "best-practice";
  occurrences?: number;
}

export interface ValidationSummary {
  counts: Record<ValidationIssue["severity"], number>;
  issues: ValidationIssue[];
  blocking: boolean;
  validated: boolean;
  httpStatus?: number;
}

export interface SubmissionReceipt {
  id: string;
  submittedAt: string;
  patientName: string;
  referralId: string;
  taskStatus: string;
  resourceIds: Record<string, string[]>;
  response: FhirResource;
}

export interface ReferralAggregate {
  serviceRequest: FhirResource;
  patient?: FhirResource;
  task?: FhirResource;
  encounter?: FhirResource;
  conditions: FhirResource[];
  observations: FhirResource[];
  procedures: FhirResource[];
  diagnosticReports: FhirResource[];
  provenances: FhirResource[];
  organizations: FhirResource[];
  practitioners: FhirResource[];
  practitionerRoles: FhirResource[];
}

export type TaskTransition =
  | "received"
  | "accepted"
  | "rejected"
  | "referred-onward"
  | "completed";
