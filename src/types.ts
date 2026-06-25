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
  psgcVersion: string;
}

export interface OrganizationInput {
  name: string;
  nhfrCode: string;
  hcpnName: string;
  phone: string;
  address: AddressInput;
  source?: "local" | "fhir";
  fhirReference?: string;
  fhirServerLabel?: string;
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
  contactRelationship: CodingInput;
  contactPhone: string;
  pwdEnabled: boolean;
  pwdId: string;
  disabilities: CodingInput[];
  pwdExpirationDate: string;
}

export type RegistryType = "registered" | "walk-in";

export interface PatientRecord {
  id: string;
  organizationId: string;
  registryType: RegistryType;
  patient: PatientInput;
  notes: string;
  linkedPatientId?: string;
  createdAt: string;
  updatedAt: string;
}

export type RequestPriority = "routine" | "urgent" | "stat";

export interface ReferralDraft {
  referralId: string;
  patientRecordId: string;
  authoredOn: string;
  timeCalled: string;
  referringPractitioner: PersonInput;
  receivingPractitioner?: PersonInput;
  initiatingFacility: OrganizationInput;
  receivingFacility: OrganizationInput;
  patient: PatientInput;
  referralCategory: CodingInput;
  priority: RequestPriority;
  requestedService: CodingInput;
  clinicalReason: CodingInput;
  referralNarrative: string;
  remarks: string;
  chiefComplaint: string;
  clinicalHistory: string;
  workingImpressionText: string;
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
  labAttachmentContentType?: string;
  referralCriteriaSatisfied: boolean;
  consentGiven: boolean;
  consentStatement: string;
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

export type ReceivingResponse =
  | "received"
  | "accepted"
  | "rejected"
  | "referred-onward";

export type CareStatus =
  | "arrived"
  | "admitted"
  | "er-observation"
  | "other-care"
  | "discharged";

export type TaskTransition =
  | ReceivingResponse
  | CareStatus
  | "completed";

export type FacilityRole = "facility_user" | "admin";

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
  password: string;
  displayName: string;
  role: FacilityRole;
  organizationId: string;
  organizationName: string;
  practitionerRoleId?: string;
}

export interface FacilityRegistrationInput {
  organizationName: string;
  nhfrCode: string;
  hcpnName: string;
  phone: string;
  address: AddressInput;
  practitionerPrefix: string;
  practitionerGiven: string;
  practitionerFamily: string;
  practitionerLicense: string;
  username: string;
  password: string;
}

export interface AppSession {
  userId: string;
  username: string;
  displayName: string;
  role: FacilityRole;
  facilityId: string;
  facilityName: string;
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
  | "failed"
  | "error";

export type TimelineStatus =
  | ReferralStatus
  | "patient-assessed"
  | "criteria-satisfied"
  | "consent-obtained"
  | CareStatus;

export interface ReferralTimelineEvent {
  id: string;
  referralId: string;
  status: TimelineStatus;
  label: string;
  note: string;
  actorOrganizationId: string;
  actorName: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  referralId: string;
  targetOrganizationId: string;
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
  patientId: string;
  patientName: string;
  referringOrganizationId: string;
  referringOrganizationName: string;
  receivingOrganizationId: string;
  receivingOrganizationName: string;
  reason: string;
  priority: RequestPriority;
  category: string;
  consentGiven: boolean;
  status: ReferralStatus;
  taskStatus: string;
  businessStatus?: ReceivingResponse;
  careStatus?: CareStatus;
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
  version: 3;
}

export interface PersistedAppState {
  version: 3;
  session: AppSession | null;
  settings: AppSettings;
  activeDraftIds: Record<string, string>;
  registeredFacilities: FacilityDefinition[];
  registeredAccounts: FacilityAccount[];
  patients: PatientRecord[];
  referrals: ReferralRecord[];
  notifications: Notification[];
}
