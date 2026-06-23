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
  demoMode: boolean;
}

export interface ValidationIssue {
  severity: "fatal" | "error" | "warning" | "information";
  code?: string;
  message: string;
  diagnostics: string;
  expression?: string[];
  location?: string[];
  category: "structural" | "terminology" | "capability" | "best-practice";
  occurrences?: number;
}

export interface ValidationSummary {
  counts: Record<ValidationIssue["severity"], number>;
  fatalCount: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
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

export type FacilityRole =
  | "referring_facility_user"
  | "receiving_facility_user"
  | "admin";

export interface FacilityDefinition {
  id: string;
  name: string;
  organization: OrganizationInput;
  practitioner: PersonInput;
  practitionerRoleId: string;
}

export interface FacilityAccount {
  id: string;
  username: string;
  displayName: string;
  role: FacilityRole;
  organizationId: string;
  organizationName: string;
  practitionerRoleId?: string;
}

export interface AppSession {
  userId: string;
  loggedInAt: string;
}

export type ReferralStatus =
  | "draft"
  | "validated"
  | "submitted"
  | "requested"
  | "received"
  | "accepted"
  | "rejected"
  | "referred-onward"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "error";

export interface ReferralTimelineEvent {
  id: string;
  referralId: string;
  status: ReferralStatus;
  label: string;
  note: string;
  actorOrganizationId: string;
  actorName: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  referralId: string;
  receivingOrganizationId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ReferralReferences {
  patientReference?: string;
  serviceRequestReference?: string;
  taskReference?: string;
  encounterReference?: string;
}

export interface ReferralRecord {
  id: string;
  localReferralId: string;
  patientName: string;
  referringOrganizationId: string;
  referringOrganizationName: string;
  receivingOrganizationId: string;
  receivingOrganizationName: string;
  reason: string;
  status: ReferralStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  validationSummary: ValidationSummary;
  validationOutcome?: FhirResource;
  transactionResponse?: FhirResource;
  transactionResponseSummary?: SubmissionReceipt;
  fhirBundle: FhirResource;
  fhirResources: FhirResource[];
  resourceReferences: ReferralReferences;
  draft: ReferralDraft;
  timeline: ReferralTimelineEvent[];
  liveSubmission: boolean;
  forwardedToOrganizationId?: string;
  forwardedToOrganizationName?: string;
  lastError?: string;
}

export interface AppSettings extends EndpointConfig {
  version: 2;
}

export interface PersistedAppState {
  version: 2;
  session: AppSession | null;
  settings: AppSettings;
  activeDraftIds: Record<string, string>;
  referrals: ReferralRecord[];
  notifications: Notification[];
}
