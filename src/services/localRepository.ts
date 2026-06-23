import { DEFAULT_ENDPOINTS } from "../config/fhir";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import type {
  AppSession,
  EndpointConfig,
  Notification,
  PersistedAppState,
  ReferralRecord,
  ReferralTimelineEvent,
  SubmissionReceipt
} from "../types";

const STATE_KEY = "pheref.appState.v2";
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

function migrateLegacyReceipts(
  receipts: SubmissionReceipt[],
  legacyDraft: ReferralRecord["draft"] | null
): ReferralRecord[] {
  if (!legacyDraft) return [];
  return receipts.map((receipt) => {
    const createdAt = receipt.submittedAt;
    const timeline: ReferralTimelineEvent[] = [
      {
        id: crypto.randomUUID(),
        referralId: receipt.id,
        status: "submitted",
        label: "Legacy submission imported",
        note: "Imported from the previous compact transaction receipt format.",
        actorOrganizationId: "unknown",
        actorName: "Legacy local data",
        timestamp: createdAt
      }
    ];
    return {
      id: receipt.id,
      localReferralId: receipt.referralId,
      patientName: receipt.patientName,
      referringOrganizationId: "unknown",
      referringOrganizationName: "Unknown referring facility",
      receivingOrganizationId: "unknown",
      receivingOrganizationName: "Unknown receiving facility",
      reason: "Imported referral",
      status: "requested",
      createdAt,
      updatedAt: createdAt,
      submittedAt: createdAt,
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
      draft: legacyDraft,
      timeline,
      liveSubmission: true
    };
  });
}

function createInitialState(): PersistedAppState {
  const legacyEndpoints = readJson<Partial<EndpointConfig>>(LEGACY_KEYS.endpoints, {});
  const receipts = readJson<SubmissionReceipt[]>(LEGACY_KEYS.receipts, []);
  const legacyDraft = readJson<ReferralRecord["draft"] | null>(LEGACY_KEYS.draft, null);
  return {
    version: 2,
    session: null,
    settings: {
      version: 2,
      ...DEFAULT_ENDPOINTS,
      ...legacyEndpoints,
      demoMode:
        typeof legacyEndpoints.demoMode === "boolean" ? legacyEndpoints.demoMode : true
    },
    activeDraftIds: {},
    referrals: migrateLegacyReceipts(receipts, legacyDraft),
    notifications: []
  };
}

function normalizeState(value: PersistedAppState): PersistedAppState {
  return {
    ...value,
    version: 2,
    session: value.session ?? null,
    settings: {
      ...DEFAULT_ENDPOINTS,
      ...value.settings,
      version: 2,
      demoMode: value.settings?.demoMode ?? true
    },
    activeDraftIds: value.activeDraftIds ?? {},
    referrals: value.referrals ?? [],
    notifications: value.notifications ?? []
  };
}

export const localRepository = {
  load(): PersistedAppState {
    const stored = readJson<PersistedAppState | null>(STATE_KEY, null);
    const state = stored?.version === 2 ? normalizeState(stored) : createInitialState();
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
    receivingOrganizationId: organizationId,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  };
}
