import {
  CLINICAL_REASON_OPTIONS,
  DEFAULT_ENDPOINTS,
  PWD_DISABILITY_OPTIONS,
  REFERRAL_CATEGORY_OPTIONS,
  RELATIONSHIP_OPTIONS,
  REQUESTED_SERVICE_OPTIONS,
  PSGC_VERSION
} from "../config/fhir";
import { createDemoDraft } from "../data/demo";
import { findAccount } from "../data/facilities";
import { DEMO_PATIENTS, patientDisplayName } from "../data/patients";
import { buildReferralTransactionBundle } from "../fhir/builders";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import type {
  AppSession,
  AddressInput,
  CodingInput,
  EndpointConfig,
  Notification,
  PatientRecord,
  PersistedAppState,
  ReferralDraft,
  ReferralRecord,
  ReferralTimelineEvent,
  SubmissionReceipt
} from "../types";

const STATE_KEY = "pheref.appState.v3";
const PREVIOUS_STATE_KEY = "pheref.appState.v2";
const LEGACY_KEYS = {
  draft: "pheref.referralDraft",
  endpoints: "pheref.endpoints",
  receipts: "pheref.receipts"
} as const;

const emptyBundle = { resourceType: "Bundle", type: "transaction", entry: [] };

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function buildSession(value: Partial<AppSession> | null | undefined): AppSession | null {
  if (!value?.userId) return null;
  const account = findAccount(value.userId);
  if (!account) return null;
  return {
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    facilityId: account.organizationId,
    facilityName: account.organizationName,
    loggedInAt: value.loggedInAt ?? new Date().toISOString()
  };
}

function matchingCoding(
  value: unknown,
  options: readonly CodingInput[],
  fallback: CodingInput
) {
  if (value && typeof value === "object") {
    const codingValue = value as Partial<CodingInput>;
    const match = options.find(
      (option) =>
        option.code === codingValue.code &&
        (!codingValue.system || option.system === codingValue.system)
    );
    if (match) return { ...match };
  }
  if (typeof value === "string") {
    const match = options.find((option) => option.code === value);
    if (match) return { ...match };
  }
  return { ...fallback };
}

const PSGC_CODE_MIGRATIONS: Record<
  string,
  { code: string; display: string }
> = {
  "1206305000": { code: "1206306000", display: "City of Koronadal" },
  "1206305012": { code: "1206306018", display: "Zone III" }
};

function normalizeAddress(
  value: unknown,
  fallback: AddressInput
): AddressInput {
  const source =
    value && typeof value === "object"
      ? (value as Partial<AddressInput>)
      : {};
  const cityMigration = source.cityCode
    ? PSGC_CODE_MIGRATIONS[source.cityCode]
    : undefined;
  const barangayMigration = source.barangayCode
    ? PSGC_CODE_MIGRATIONS[source.barangayCode]
    : undefined;
  return {
    ...fallback,
    ...source,
    city: cityMigration?.display ?? source.city ?? fallback.city,
    cityCode: cityMigration?.code ?? source.cityCode ?? fallback.cityCode,
    barangay:
      barangayMigration?.display ?? source.barangay ?? fallback.barangay,
    barangayCode:
      barangayMigration?.code ??
      source.barangayCode ??
      fallback.barangayCode,
    psgcVersion: PSGC_VERSION
  };
}

function normalizeOrganization<T extends { address: AddressInput }>(
  value: Partial<T> | undefined,
  fallback: T
): T {
  return {
    ...fallback,
    ...value,
    address: normalizeAddress(value?.address, fallback.address)
  } as T;
}

function normalizePatient(value: unknown): ReferralDraft["patient"] {
  const fallback = createDemoDraft().patient;
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const legacyDisability = source.disability;
  const disabilityValues = Array.isArray(source.disabilities)
    ? source.disabilities
    : legacyDisability
      ? [legacyDisability]
      : [];
  return {
    ...fallback,
    ...source,
    address: normalizeAddress(source.address, fallback.address),
    contactRelationship: matchingCoding(
      source.contactRelationship,
      RELATIONSHIP_OPTIONS,
      RELATIONSHIP_OPTIONS[0]
    ),
    disabilities: disabilityValues.flatMap((value) => {
      const match = matchingCoding(
        value,
        PWD_DISABILITY_OPTIONS,
        PWD_DISABILITY_OPTIONS[0]
      );
      return value &&
        typeof value === "object" &&
        PWD_DISABILITY_OPTIONS.some(
          (option) => option.code === (value as Partial<CodingInput>).code
        )
        ? [match]
        : [];
    })
  } as ReferralDraft["patient"];
}

function normalizeDraft(value: Partial<ReferralDraft> & Record<string, unknown>): ReferralDraft {
  const fallback = createDemoDraft();
  const legacyService = value.serviceType as ReferralDraft["requestedService"] | undefined;
  const initiatingFacility = normalizeOrganization(
    value.initiatingFacility,
    fallback.initiatingFacility
  );
  const receivingFacility = normalizeOrganization(
    value.receivingFacility,
    fallback.receivingFacility
  );
  const draft = {
    ...fallback,
    ...value,
    patientRecordId: value.patientRecordId ?? "",
    timeCalled: value.timeCalled ?? value.authoredOn ?? fallback.timeCalled,
    patient: normalizePatient(value.patient),
    referralCategory: matchingCoding(
      value.referralCategory,
      REFERRAL_CATEGORY_OPTIONS,
      fallback.referralCategory
    ),
    requestedService: matchingCoding(
      value.requestedService ?? legacyService,
      REQUESTED_SERVICE_OPTIONS,
      fallback.requestedService
    ),
    clinicalReason: matchingCoding(
      value.clinicalReason ?? value.workingImpression,
      CLINICAL_REASON_OPTIONS,
      fallback.clinicalReason
    ),
    initiatingFacility,
    receivingFacility,
    receivingPractitioner: receivingFacility.fhirReference
      ? undefined
      : value.receivingPractitioner ?? fallback.receivingPractitioner,
    priority: value.priority ?? "urgent",
    remarks: value.remarks ?? "",
    referralCriteriaSatisfied: value.referralCriteriaSatisfied ?? false,
    consentGiven: value.consentGiven ?? false,
    consentStatement: value.consentStatement ?? fallback.consentStatement
  };
  return draft;
}

function normalizePatientRecord(value: PatientRecord): PatientRecord {
  return {
    ...value,
    patient: normalizePatient(value.patient)
  };
}

function normalizeReferral(value: ReferralRecord & Record<string, unknown>): ReferralRecord {
  const draft = normalizeDraft(value.draft as ReferralDraft & Record<string, unknown>);
  const patientId = value.patientId || draft.patientRecordId || `migrated-${value.id}`;
  draft.patientRecordId = patientId;
  return {
    ...value,
    draft,
    patientId,
    patientName: value.patientName || patientDisplayName(draft.patient),
    reason: value.reason || draft.requestedService.display,
    priority: value.priority ?? draft.priority,
    category: value.category ?? draft.referralCategory.display,
    consentGiven: value.consentGiven ?? draft.consentGiven,
    taskStatus: value.taskStatus ?? value.status ?? "requested",
    timeline: value.timeline ?? [],
    fhirBundle:
      value.status === "draft" ||
      value.status === "validated" ||
      value.status === "error"
        ? buildReferralTransactionBundle(draft)
        : value.fhirBundle ?? emptyBundle,
    fhirResources: value.fhirResources ?? [],
    resourceReferences: value.resourceReferences ?? {},
    validationSummary: value.validationSummary ?? emptyValidationSummary(),
    liveSubmission: value.liveSubmission ?? false
  };
}

function patientsFromReferrals(referrals: ReferralRecord[]): PatientRecord[] {
  const now = new Date().toISOString();
  const migrated = referrals.map((referral) => ({
    id: referral.patientId,
    organizationId: referral.referringOrganizationId,
    registryType: "registered" as const,
    patient: structuredClone(referral.draft.patient),
    notes: "Migrated from an existing local referral.",
    createdAt: referral.createdAt ?? now,
    updatedAt: referral.updatedAt ?? now
  }));
  return [
    ...new Map(
      [...DEMO_PATIENTS, ...migrated].map((patient) => [patient.id, patient])
    ).values()
  ];
}

function normalizeNotification(
  value: Notification & { receivingOrganizationId?: string }
): Notification {
  return {
    id: value.id,
    referralId: value.referralId,
    targetOrganizationId:
      value.targetOrganizationId ?? value.receivingOrganizationId ?? "unknown",
    title: value.title,
    message: value.message,
    read: value.read ?? false,
    createdAt: value.createdAt
  };
}

function migrateVersion2(value: Record<string, unknown>): PersistedAppState {
  const referrals = (
    Array.isArray(value.referrals) ? value.referrals : []
  ).map((item) => normalizeReferral(item as ReferralRecord & Record<string, unknown>));
  const oldSettings = (value.settings ?? {}) as Partial<EndpointConfig>;
  return {
    version: 3,
    session: buildSession(value.session as Partial<AppSession> | null),
    settings: {
      version: 3,
      ...DEFAULT_ENDPOINTS,
      ...oldSettings,
      demoMode: oldSettings.demoMode ?? true
    },
    activeDraftIds:
      (value.activeDraftIds as Record<string, string> | undefined) ?? {},
    patients: patientsFromReferrals(referrals).map(normalizePatientRecord),
    referrals,
    notifications: (
      Array.isArray(value.notifications) ? value.notifications : []
    ).map((item) =>
      normalizeNotification(
        item as Notification & { receivingOrganizationId?: string }
      )
    )
  };
}

function migrateLegacyReceipts(
  receipts: SubmissionReceipt[],
  legacyDraftValue: ReferralDraft | null
): ReferralRecord[] {
  if (!legacyDraftValue) return [];
  const legacyDraft = normalizeDraft(
    legacyDraftValue as ReferralDraft & Record<string, unknown>
  );
  return receipts.map((receipt) => {
    const patientId = `migrated-${receipt.id}`;
    legacyDraft.patientRecordId = patientId;
    const timeline: ReferralTimelineEvent[] = [
      {
        id: crypto.randomUUID(),
        referralId: receipt.id,
        status: "submitted",
        label: "Legacy submission imported",
        note: "Imported from the previous compact transaction receipt format.",
        actorOrganizationId: "unknown",
        actorName: "Legacy local data",
        timestamp: receipt.submittedAt
      }
    ];
    return {
      id: receipt.id,
      localReferralId: receipt.referralId,
      patientId,
      patientName: receipt.patientName,
      referringOrganizationId: "unknown",
      referringOrganizationName: "Unknown referring facility",
      receivingOrganizationId: "unknown",
      receivingOrganizationName: "Unknown receiving facility",
      reason: legacyDraft.requestedService.display,
      priority: legacyDraft.priority,
      category: legacyDraft.referralCategory.display,
      consentGiven: legacyDraft.consentGiven,
      status: "requested",
      taskStatus: "requested",
      createdAt: receipt.submittedAt,
      updatedAt: receipt.submittedAt,
      submittedAt: receipt.submittedAt,
      validationSummary: emptyValidationSummary(),
      transactionResponse: receipt.response,
      transactionResponseSummary: receipt,
      fhirBundle: emptyBundle,
      fhirResources: [],
      resourceReferences: {
        patientReference: receipt.resourceIds.Patient?.[0]
          ? `Patient/${receipt.resourceIds.Patient[0]}`
          : undefined,
        serviceRequestReference: receipt.resourceIds.ServiceRequest?.[0]
          ? `ServiceRequest/${receipt.resourceIds.ServiceRequest[0]}`
          : undefined,
        taskReference: receipt.resourceIds.Task?.[0]
          ? `Task/${receipt.resourceIds.Task[0]}`
          : undefined
      },
      draft: structuredClone(legacyDraft),
      timeline,
      liveSubmission: true
    };
  });
}

function createInitialState(): PersistedAppState {
  const legacyEndpoints = readJson<Partial<EndpointConfig>>(LEGACY_KEYS.endpoints, {});
  const receipts = readJson<SubmissionReceipt[]>(LEGACY_KEYS.receipts, []);
  const legacyDraft = readJson<ReferralDraft | null>(LEGACY_KEYS.draft, null);
  const referrals = migrateLegacyReceipts(receipts, legacyDraft);
  return {
    version: 3,
    session: null,
    settings: {
      version: 3,
      ...DEFAULT_ENDPOINTS,
      ...legacyEndpoints,
      demoMode: legacyEndpoints.demoMode ?? true
    },
    activeDraftIds: {},
    patients: patientsFromReferrals(referrals),
    referrals,
    notifications: []
  };
}

function normalizeState(value: PersistedAppState): PersistedAppState {
  const referrals = (value.referrals ?? []).map((referral) =>
    normalizeReferral(referral as ReferralRecord & Record<string, unknown>)
  );
  return {
    ...value,
    version: 3,
    session: buildSession(value.session),
    settings: {
      ...DEFAULT_ENDPOINTS,
      ...value.settings,
      version: 3,
      demoMode: value.settings?.demoMode ?? true
    },
    activeDraftIds: value.activeDraftIds ?? {},
    patients: (
      value.patients?.length ? value.patients : patientsFromReferrals(referrals)
    ).map(normalizePatientRecord),
    referrals,
    notifications: (value.notifications ?? []).map((notification) =>
      normalizeNotification(notification)
    )
  };
}

export const localRepository = {
  load(): PersistedAppState {
    const current = readJson<PersistedAppState | null>(STATE_KEY, null);
    if (current?.version === 3) {
      const state = normalizeState(current);
      this.save(state);
      return state;
    }
    const previous = readJson<Record<string, unknown> | null>(
      PREVIOUS_STATE_KEY,
      null
    );
    const state = previous ? migrateVersion2(previous) : createInitialState();
    this.save(state);
    return state;
  },
  save(state: PersistedAppState) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  },
  clearSession(state: PersistedAppState): PersistedAppState {
    const next = { ...state, session: null };
    this.save(next);
    return next;
  },
  setSession(state: PersistedAppState, session: AppSession): PersistedAppState {
    const next = { ...state, session };
    this.save(next);
    return next;
  },
  reset() {
    localStorage.removeItem(STATE_KEY);
  }
};

export function createNotification(
  referralId: string,
  organizationId: string,
  title: string,
  message: string
): Notification {
  return {
    id: crypto.randomUUID(),
    referralId,
    targetOrganizationId: organizationId,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  };
}
