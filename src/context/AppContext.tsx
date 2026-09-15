import { useMemo, useState, type PropsWithChildren } from "react";
import {
  assertExternalWritesAllowed,
  CONNECTATHON_CONFIG,
  DEFAULT_ENDPOINTS,
  IDENTIFIER_SYSTEMS
} from "../config/fhir";
import {
  DEMO_ACCOUNTS,
  FACILITIES
} from "../data/facilities";
import { createDemoDraft } from "../data/demo";
import { createEmptyPatient, patientDisplayName } from "../data/patients";
import { buildOrganization } from "../fhir/builders";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import {
  applyTaskTransition,
  isReceivingResponseTransition
} from "../fhir/taskTransitions";
import {
  parseTransactionResponse,
  readResource,
  submitTransactionBundle,
  updateResource,
  validateResourceDetailed
} from "../services/fhirClient";
import { createFacilityRegistration } from "../services/facilityRegistration";
import { findResource, resolveTransactionBundle } from "../services/demoFhir";
import { createNotification, localRepository } from "../services/localRepository";
import { organizationDestinationId } from "../services/organizationDirectory";
import { createPatientRecord } from "../services/patientRegistry";
import {
  hydrateReferral,
  parseReference,
  searchIncomingReferralsForFacility
} from "../services/referralRetrieval";
import {
  assertNonBlockingValidation,
  assertReferralSubmissionReady
} from "../services/referralValidation";
import {
  createDraftRecord,
  createTimelineEvent,
  incomingReferralsForAccount,
  notificationsForAccount,
  referralsForAccount,
  sentReferralsForAccount,
  updateDraftRecord
} from "../services/referralRecords";
import type {
  AppSettings,
  CareStatus,
  CodingInput,
  FacilityAccount,
  FacilityDefinition,
  FacilityPublishResult,
  FacilityRegistrationInput,
  FacilityRegistrationResult,
  FhirResource,
  PatientInput,
  PatientRecord,
  PersistedAppState,
  ReceivingResponse,
  ReferralDraft,
  ReferralRecord,
  ReferralStatus,
  RegistryType,
  TaskTransition,
  ValidationSummary
} from "../types";
import { AppContext } from "./appContextValue";

function firstCodeable(value: unknown) {
  const source = Array.isArray(value) ? value[0] : value;
  const coding = (
    source as { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string } | undefined
  )?.coding?.[0];
  return {
    system: coding?.system ?? "",
    code: coding?.code ?? "",
    display:
      coding?.display ??
      (source as { text?: string } | undefined)?.text ??
      ""
  };
}

function firstIdentifier(
  resource: FhirResource | undefined,
  system: string
) {
  return (
    resource?.identifier as Array<{ system?: string; value?: string }> | undefined
  )?.find((identifier) => identifier.system === system)?.value ?? "";
}

function patientFromResource(resource: FhirResource | undefined): PatientInput {
  const patient = createEmptyPatient();
  if (!resource) return patient;
  const name = (
    resource.name as Array<{ given?: string[]; family?: string; text?: string }> | undefined
  )?.[0];
  const textParts = name?.text?.split(" ").filter(Boolean) ?? [];
  patient.given = name?.given?.join(" ") ?? textParts.slice(0, -1).join(" ");
  patient.family = name?.family ?? textParts.at(-1) ?? "";
  patient.gender =
    resource.gender === "male" ||
    resource.gender === "female" ||
    resource.gender === "other" ||
    resource.gender === "unknown"
      ? resource.gender
      : "unknown";
  patient.birthDate = typeof resource.birthDate === "string" ? resource.birthDate : "";
  patient.philSysId = firstIdentifier(resource, IDENTIFIER_SYSTEMS.philSys);
  patient.philHealthId = firstIdentifier(
    resource,
    IDENTIFIER_SYSTEMS.philHealth
  );
  patient.phone =
    (
      resource.telecom as Array<{ system?: string; value?: string }> | undefined
    )?.find((telecom) => telecom.system === "phone")?.value ?? "";
  return patient;
}

function organizationName(resource: FhirResource | undefined, fallback: string) {
  return typeof resource?.name === "string" ? resource.name : fallback;
}

function taskBusinessStatus(task: FhirResource | undefined): ReceivingResponse | undefined {
  return task ? businessStatusFromTask(task) : undefined;
}

function referencesFromResources(resources: FhirResource[]) {
  const patient = findResource(resources, "Patient");
  const serviceRequest = findResource(resources, "ServiceRequest");
  const task = findResource(resources, "Task");
  const encounter = findResource(resources, "Encounter");
  return {
    patientReference: patient?.id ? `Patient/${patient.id}` : undefined,
    serviceRequestReference: serviceRequest?.id
      ? `ServiceRequest/${serviceRequest.id}`
      : undefined,
    taskReference: task?.id ? `Task/${task.id}` : undefined,
    encounterReference: encounter?.id ? `Encounter/${encounter.id}` : undefined
  };
}

function businessStatusFromTask(task: FhirResource): ReceivingResponse | undefined {
  const code = (
    task.businessStatus as { coding?: Array<{ code?: string }> } | undefined
  )?.coding?.[0]?.code;
  return code === "received" ||
    code === "accepted" ||
    code === "rejected" ||
    code === "referred-onward"
    ? code
    : undefined;
}

function statusFromTask(task: FhirResource): ReferralStatus {
  const businessStatus = businessStatusFromTask(task);
  if (businessStatus === "referred-onward") return "referred-onward";
  const status = String(task.status ?? "requested");
  return status === "received" ||
    status === "accepted" ||
    status === "rejected" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "failed" ||
    status === "in-progress"
    ? status
    : "requested";
}

function careStatusFromTransition(transition: TaskTransition): CareStatus | undefined {
  return transition === "arrived" ||
    transition === "admitted" ||
    transition === "er-observation" ||
    transition === "other-care" ||
    transition === "discharged"
    ? transition
    : undefined;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedAppState>(() => localRepository.load());
  const effectiveSettings = useMemo<AppSettings>(
    () => ({
      ...state.settings,
      demoMode: CONNECTATHON_CONFIG.capabilities.externalWrites
        ? state.settings.demoMode
        : true
    }),
    [state.settings]
  );
  const facilities = useMemo<FacilityDefinition[]>(
    () => [...FACILITIES, ...state.registeredFacilities],
    [state.registeredFacilities]
  );
  const accounts = useMemo<FacilityAccount[]>(
    () => [...DEMO_ACCOUNTS, ...state.registeredAccounts],
    [state.registeredAccounts]
  );
  const findFacilityById = (id: string) =>
    facilities.find((facility) => facility.id === id);
  const currentAccount = state.session
    ? accounts.find((account) => account.id === state.session?.userId) ?? null
    : null;
  const activeDraftId = currentAccount ? state.activeDraftIds[currentAccount.id] : undefined;
  const activeDraftRecord =
    state.referrals.find((referral) => referral.id === activeDraftId) ?? null;

  function commit(updater: (current: PersistedAppState) => PersistedAppState) {
    setState((current) => {
      const next = updater(current);
      localRepository.save(next);
      return next;
    });
  }

  function login(username: string, password: string) {
    const account = accounts.find(
      (item) =>
        item.username.toLowerCase() === username.trim().toLowerCase() &&
        item.password === password
    );
    if (!account) throw new Error("Invalid username or password.");
    commit((current) => ({
      ...current,
      session: {
        userId: account.id,
        username: account.username,
        displayName: account.displayName,
        role: account.role,
        facilityId: account.organizationId,
        facilityName: account.organizationName,
        loggedInAt: new Date().toISOString()
      }
    }));
  }

  function logout() {
    commit((current) => ({ ...current, session: null }));
  }

  function setEndpoints(settings: AppSettings) {
    commit((current) => ({
      ...current,
      settings: {
        ...settings,
        demoMode: CONNECTATHON_CONFIG.capabilities.externalWrites
          ? settings.demoMode
          : true
      }
    }));
  }

  function resetEndpoints() {
    commit((current) => ({
      ...current,
      settings: { version: 3, ...DEFAULT_ENDPOINTS }
    }));
  }

  function saveFacilityRegistration(
    value: FacilityRegistrationInput,
    signIn: boolean
  ): FacilityRegistrationResult {
    const result = createFacilityRegistration(value, accounts, facilities);
    commit((current) => ({
      ...current,
      session: signIn
        ? {
            userId: result.account.id,
            username: result.account.username,
            displayName: result.account.displayName,
            role: result.account.role,
            facilityId: result.facility.id,
            facilityName: result.facility.name,
            loggedInAt: new Date().toISOString()
          }
        : current.session,
      registeredFacilities: [result.facility, ...current.registeredFacilities],
      registeredAccounts: [result.account, ...current.registeredAccounts]
    }));
    return result;
  }

  function registerFacility(
    value: FacilityRegistrationInput
  ): FacilityRegistrationResult {
    if (!currentAccount || currentAccount.role !== "admin") {
      throw new Error("Only an administrator can register facilities here.");
    }
    return saveFacilityRegistration(value, false);
  }

  function selfRegisterFacility(
    value: FacilityRegistrationInput
  ): FacilityRegistrationResult {
    if (currentAccount) {
      throw new Error("Sign out before creating a self-registration account.");
    }
    return saveFacilityRegistration(value, true);
  }

  function organizationReferenceFromResponse(response: FhirResource) {
    const firstEntry = Array.isArray(response.entry)
      ? (response.entry[0] as { response?: { location?: string } } | undefined)
      : undefined;
    const location = firstEntry?.response?.location;
    const match = location?.match(/^(Organization\/[^/]+)/);
    return match?.[1];
  }

  async function publishFacility(
    facilityId: string
  ): Promise<FacilityPublishResult> {
    assertExternalWritesAllowed();
    if (state.settings.demoMode) {
      throw new Error("Disable Demo mode before publishing an Organization.");
    }
    const facility = state.registeredFacilities.find(
      (item) => item.id === facilityId
    );
    if (!facility) throw new Error("Only user-created facilities can be published.");
    const ownsFacility = currentAccount?.organizationId === facility.id;
    if (!currentAccount || (!ownsFacility && currentAccount.role !== "admin")) {
      throw new Error("You may publish only your own facility.");
    }

    const organization = buildOrganization(facility.organization);
    const validation = await validateResourceDetailed(
      state.settings.pherefBaseUrl,
      "Organization",
      organization
    );
    const validationFailed =
      !validation.summary.validated ||
      validation.summary.blocking ||
      (validation.summary.httpStatus ?? 200) >= 400;
    if (validationFailed) {
      return {
        facility,
        published: false,
        validationSummary: validation.summary,
        validationOutcome: validation.outcome
      };
    }

    const response = await submitTransactionBundle(
      state.settings.pherefBaseUrl,
      {
        resourceType: "Bundle",
        type: "transaction",
        entry: [
          {
            fullUrl: `urn:uuid:${crypto.randomUUID()}`,
            resource: organization,
            request: {
              method: "PUT",
              url: `Organization?identifier=${IDENTIFIER_SYSTEMS.nhfr}|${facility.organization.nhfrCode}`
            }
          }
        ]
      }
    );
    const fhirReference = organizationReferenceFromResponse(response);
    if (!fhirReference) {
      throw new Error(
        "The transaction succeeded but did not return an Organization location."
      );
    }
    const publishedFacility: FacilityDefinition = {
      ...facility,
      organization: {
        ...facility.organization,
        source: "fhir",
        fhirReference,
        fhirServerLabel: "PHeRef CDR"
      }
    };
    commit((current) => ({
      ...current,
      registeredFacilities: current.registeredFacilities.map((item) =>
        item.id === facility.id ? publishedFacility : item
      )
    }));
    return {
      facility: publishedFacility,
      published: true,
      validationSummary: validation.summary,
      validationOutcome: validation.outcome,
      response
    };
  }

  function savePatient(
    patient: PatientInput,
    registryType: RegistryType,
    notes: string,
    existingId?: string
  ): PatientRecord {
    if (!currentAccount || currentAccount.role !== "facility_user") {
      throw new Error("A facility account is required to maintain the patient registry.");
    }
    const existing = existingId
      ? state.patients.find(
          (record) =>
            record.id === existingId &&
            record.organizationId === currentAccount.organizationId
        )
      : undefined;
    const record = existing
      ? {
          ...existing,
          patient: structuredClone(patient),
          registryType,
          notes,
          updatedAt: new Date().toISOString()
        }
      : createPatientRecord(
          currentAccount.organizationId,
          structuredClone(patient),
          registryType,
          notes
        );
    commit((current) => ({
      ...current,
      patients: existing
        ? current.patients.map((item) => (item.id === record.id ? record : item))
        : [record, ...current.patients]
    }));
    return record;
  }

  function linkWalkInPatient(walkInId: string, patientId: string) {
    if (!currentAccount || currentAccount.role !== "facility_user") return;
    commit((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === walkInId &&
        patient.organizationId === currentAccount.organizationId &&
        patient.registryType === "walk-in"
          ? {
              ...patient,
              linkedPatientId: patientId,
              updatedAt: new Date().toISOString()
            }
          : patient
      )
    }));
  }

  function startNewReferral(patientId: string): string {
    if (!currentAccount || currentAccount.role !== "facility_user") {
      throw new Error("Only facility users can create referrals.");
    }
    const patient = state.patients.find(
      (record) =>
        record.id === patientId &&
        record.organizationId === currentAccount.organizationId
    );
    const referring = findFacilityById(currentAccount.organizationId);
    const receiving = facilities.find(
      (facility) => facility.id !== currentAccount.organizationId
    );
    if (!patient || !referring || !receiving) {
      throw new Error("Patient or facility configuration is incomplete.");
    }
    const record = createDraftRecord(
      createDemoDraft(referring, receiving, patient),
      currentAccount,
      receiving.id
    );
    commit((current) => ({
      ...current,
      activeDraftIds: { ...current.activeDraftIds, [currentAccount.id]: record.id },
      referrals: [record, ...current.referrals.filter((item) => item.id !== record.id)]
    }));
    return record.id;
  }

  function setDraft(draft: ReferralDraft) {
    if (!currentAccount || !activeDraftRecord) return;
    const receiving = draft.receivingFacility.fhirReference
      ? undefined
      : facilities.find(
          (facility) =>
            facility.organization.nhfrCode === draft.receivingFacility.nhfrCode
        );
    const previous = activeDraftRecord.draft;
    commit((current) => ({
      ...current,
      referrals: current.referrals.map((record) => {
        if (record.id !== activeDraftRecord.id) return record;
        const updated = updateDraftRecord(
          record,
          draft,
          receiving?.id ?? organizationDestinationId(draft.receivingFacility)
        );
        const events = [...updated.timeline];
        if (!previous.referralCriteriaSatisfied && draft.referralCriteriaSatisfied) {
          events.push(
            createTimelineEvent(
              record.id,
              "patient-assessed",
              "Patient assessment and clinical summary recorded.",
              currentAccount
            ),
            createTimelineEvent(
              record.id,
              "criteria-satisfied",
              "Local referral criteria were marked as satisfied.",
              currentAccount
            )
          );
        }
        if (!previous.consentGiven && draft.consentGiven) {
          events.push(
            createTimelineEvent(
              record.id,
              "consent-obtained",
              "Patient or representative consent was recorded locally.",
              currentAccount
            )
          );
        }
        return { ...updated, timeline: events };
      })
    }));
  }

  function resetDraft() {
    if (!currentAccount || !activeDraftRecord) return;
    const referring = findFacilityById(currentAccount.organizationId);
    const receiving =
      findFacilityById(activeDraftRecord.receivingOrganizationId) ??
      facilities.find((facility) => facility.id !== currentAccount.organizationId);
    const patient = state.patients.find(
      (item) => item.id === activeDraftRecord.patientId
    );
    if (referring && receiving && patient) {
      const reset = createDemoDraft(referring, receiving, patient);
      if (activeDraftRecord.draft.receivingFacility.fhirReference) {
        reset.receivingFacility = structuredClone(
          activeDraftRecord.draft.receivingFacility
        );
        reset.receivingPractitioner = undefined;
      }
      setDraft(reset);
    }
  }

  function cancelDraft() {
    if (!currentAccount || !activeDraftRecord) return;
    commit((current) => ({
      ...current,
      activeDraftIds: Object.fromEntries(
        Object.entries(current.activeDraftIds).filter(
          ([accountId]) => accountId !== currentAccount.id
        )
      ),
      referrals: current.referrals.filter(
        (record) =>
          record.id !== activeDraftRecord.id || record.status !== "draft"
      )
    }));
  }

  function saveValidation(summary: ValidationSummary, outcome?: FhirResource) {
    if (!currentAccount || !activeDraftRecord) return;
    const status: ReferralStatus = summary.blocking ? "error" : "validated";
    commit((current) => ({
      ...current,
      referrals: current.referrals.map((record) =>
        record.id === activeDraftRecord.id
          ? {
              ...record,
              status,
              updatedAt: new Date().toISOString(),
              validationSummary: summary,
              validationOutcome: outcome,
              timeline: [
                ...record.timeline,
                createTimelineEvent(
                  record.id,
                  status,
                  summary.blocking
                    ? "Validation completed with blocking issues."
                    : "FHIR Bundle validation completed without blocking issues.",
                  currentAccount
                )
              ]
            }
          : record
      )
    }));
  }

  async function submitCurrentReferral(): Promise<ReferralRecord> {
    if (!currentAccount || !activeDraftRecord) {
      throw new Error("No active referral draft.");
    }
    assertReferralSubmissionReady(activeDraftRecord.draft);
    if (
      !CONNECTATHON_CONFIG.capabilities.externalWrites &&
      !CONNECTATHON_CONFIG.capabilities.localSimulation
    ) {
      throw new Error(
        "Submission is locked by the participant preset. Complete validation, then run npm run dev:ready explicitly."
      );
    }
    assertNonBlockingValidation(activeDraftRecord.validationSummary);
    const bundle = activeDraftRecord.fhirBundle;
    const liveWrite =
      CONNECTATHON_CONFIG.capabilities.externalWrites && !state.settings.demoMode;
    const remoteResponse = !liveWrite
      ? undefined
      : await submitTransactionBundle(state.settings.pherefBaseUrl, bundle);
    const resolved = resolveTransactionBundle(bundle, remoteResponse);
    const receipt = parseTransactionResponse(
      resolved.response,
      activeDraftRecord.patientName,
      activeDraftRecord.localReferralId
    );
    const now = new Date().toISOString();
    const updated: ReferralRecord = {
      ...activeDraftRecord,
      status: "requested",
      taskStatus: "requested",
      updatedAt: now,
      submittedAt: now,
      transactionResponse: resolved.response,
      transactionResponseSummary: receipt,
      fhirResources: resolved.resources,
      resourceReferences: referencesFromResources(resolved.resources),
      liveSubmission: liveWrite,
      timeline: [
        ...activeDraftRecord.timeline,
        createTimelineEvent(
          activeDraftRecord.id,
          "submitted",
          liveWrite
            ? "Referral transaction submitted to the PHeReF CDR."
            : "Referral submitted to the local Connectathon demo store.",
          currentAccount
        ),
        createTimelineEvent(
          activeDraftRecord.id,
          "requested",
          "Receiving facility response requested.",
          currentAccount
        )
      ]
    };
    const localDestination = facilities.some(
      (facility) => facility.id === updated.receivingOrganizationId
    );
    commit((current) => ({
      ...current,
      activeDraftIds: Object.fromEntries(
        Object.entries(current.activeDraftIds).filter(
          ([accountId]) => accountId !== currentAccount.id
        )
      ),
      referrals: current.referrals.map((record) =>
        record.id === updated.id ? updated : record
      ),
      notifications: localDestination
        ? [
            createNotification(
              updated.id,
              updated.receivingOrganizationId,
              "New referral received",
              `New referral for ${updated.patientName} from ${updated.referringOrganizationName}.`
            ),
            ...current.notifications
          ]
        : current.notifications
    }));
    return updated;
  }

  async function transitionReferral(
    referralId: string,
    transition: TaskTransition,
    note: string,
    forwardingFacilityId?: string,
    receivingResponseCoding?: CodingInput
  ): Promise<ReferralRecord> {
    if (
      !CONNECTATHON_CONFIG.capabilities.externalWrites &&
      !CONNECTATHON_CONFIG.capabilities.localSimulation
    ) {
      throw new Error(
        "Task updates are locked by the participant preset. Run the ready preset after completing the readiness checks."
      );
    }
    if (!currentAccount || currentAccount.role !== "facility_user") {
      throw new Error("A facility user is required to update referral status.");
    }
    const record = state.referrals.find((item) => item.id === referralId);
    const assignedToCurrentFacility =
      record?.receivingOrganizationId === currentAccount.organizationId ||
      record?.forwardedToOrganizationId === currentAccount.organizationId;
    if (!record || !assignedToCurrentFacility) {
      throw new Error("Referral is not assigned to the current facility.");
    }
    if (transition === "referred-onward" && !forwardingFacilityId) {
      throw new Error("A forwarding facility is required.");
    }
    if (
      CONNECTATHON_CONFIG.preset === "ready" &&
      isReceivingResponseTransition(transition) &&
      receivingResponseCoding?.code !== transition
    ) {
      throw new Error(
        "Ready mode requires this receiving response code from a live terminology expansion."
      );
    }
    const taskId = record.resourceReferences.taskReference?.split("/")[1];
    const storedTask = findResource(record.fhirResources, "Task");
    if (!taskId || !storedTask) {
      throw new Error("The referral does not have a Task resource.");
    }

    try {
      const sourceTask = record.liveSubmission
        ? await readResource(state.settings.pherefBaseUrl, "Task", taskId)
        : storedTask;
      const effectiveNote = note.trim();
      const updatedTask = applyTaskTransition(
        sourceTask,
        transition,
        effectiveNote,
        receivingResponseCoding
      );
      const savedTask = record.liveSubmission
        ? await updateResource(
            state.settings.pherefBaseUrl,
            "Task",
            taskId,
            updatedTask
          )
        : updatedTask;
      const status = statusFromTask(savedTask);
      const businessStatus = businessStatusFromTask(savedTask);
      const careStatus = careStatusFromTransition(transition) ?? record.careStatus;
      const forwardingFacility = forwardingFacilityId
        ? findFacilityById(forwardingFacilityId)
        : undefined;
      const now = new Date().toISOString();
      const updated: ReferralRecord = {
        ...record,
        status,
        taskStatus: String(savedTask.status ?? status),
        businessStatus,
        careStatus,
        updatedAt: now,
        fhirResources: record.fhirResources.map((resource) =>
          resource.resourceType === "Task" ? savedTask : resource
        ),
        forwardedToOrganizationId:
          transition === "referred-onward"
            ? forwardingFacility?.id
            : record.forwardedToOrganizationId,
        forwardedToOrganizationName:
          transition === "referred-onward"
            ? forwardingFacility?.name
            : record.forwardedToOrganizationName,
        lastError: undefined,
        timeline: [
          ...record.timeline,
          createTimelineEvent(
            record.id,
            careStatusFromTransition(transition) ?? status,
            transition === "referred-onward" && forwardingFacility
              ? `Referred onward to ${forwardingFacility.name}. ${effectiveNote}`
              : effectiveNote,
            currentAccount
          )
        ]
      };
      commit((current) => {
        const responseNotification = isReceivingResponseTransition(transition);
        const referrerNotification = createNotification(
          updated.id,
          updated.referringOrganizationId,
          responseNotification
            ? `Referral ${status}`
            : `Referral tracking update: ${careStatus ?? status}`,
          responseNotification
            ? `${currentAccount.organizationName} recorded a ${transition} response for ${updated.patientName}'s referral.`
            : `${currentAccount.organizationName} recorded ${careStatus ?? status} for ${updated.patientName}'s referral.`
        );
        const onwardNotification =
          transition === "referred-onward" && forwardingFacility
            ? createNotification(
                updated.id,
                forwardingFacility.id,
                "Referral referred onward",
                `${updated.receivingOrganizationName} referred ${updated.patientName}'s referral onward to ${forwardingFacility.name}.`
              )
            : undefined;
        return {
          ...current,
          referrals: current.referrals.map((item) =>
            item.id === updated.id ? updated : item
          ),
          notifications: [
            referrerNotification,
            ...(onwardNotification ? [onwardNotification] : []),
            ...current.notifications.map((notification) =>
              notification.referralId === updated.id &&
              notification.targetOrganizationId === currentAccount.organizationId
                ? { ...notification, read: true }
                : notification
            )
          ]
        };
      });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Task update failed.";
      commit((current) => ({
        ...current,
        referrals: current.referrals.map((item) =>
          item.id === record.id
            ? {
                ...item,
                lastError: message,
                timeline: [
                  ...item.timeline,
                  createTimelineEvent(
                    item.id,
                    "error",
                    `Workflow update failed: ${message}`,
                    currentAccount
                  )
                ]
              }
            : item
        )
      }));
      throw error;
    }
  }

  async function refreshReferral(referralId: string): Promise<ReferralRecord> {
    const record = state.referrals.find((item) => item.id === referralId);
    if (!record) throw new Error("Referral not found.");
    if (!record.liveSubmission) return record;
    const taskId = record.resourceReferences.taskReference?.split("/")[1];
    if (!taskId) throw new Error("Referral has no Task reference.");
    const task = await readResource(state.settings.pherefBaseUrl, "Task", taskId);
    const status = statusFromTask(task);
    const updated = {
      ...record,
      status,
      taskStatus: String(task.status ?? status),
      businessStatus: businessStatusFromTask(task),
      updatedAt: String(task.lastModified ?? new Date().toISOString()),
      fhirResources: record.fhirResources.map((resource) =>
        resource.resourceType === "Task" ? task : resource
      )
    };
    commit((current) => ({
      ...current,
      referrals: current.referrals.map((item) =>
        item.id === updated.id ? updated : item
      )
    }));
    return updated;
  }

  async function refreshLiveIncomingReferrals(): Promise<number> {
    if (!currentAccount || currentAccount.role !== "facility_user") {
      throw new Error("A facility account is required to retrieve incoming referrals.");
    }
    const facility = findFacilityById(currentAccount.organizationId);
    if (!facility) throw new Error("Current facility configuration was not found.");
    const serviceRequests = await searchIncomingReferralsForFacility(
      state.settings.pherefBaseUrl,
      facility.organization
    );
    const aggregates = await Promise.all(
      serviceRequests.map((serviceRequest) =>
        hydrateReferral(state.settings.pherefBaseUrl, serviceRequest)
      )
    );
    const now = new Date().toISOString();
    const records = aggregates.flatMap((aggregate): ReferralRecord[] => {
      const serviceRequest = aggregate.serviceRequest;
      if (!serviceRequest.id) return [];
      const patient = patientFromResource(aggregate.patient);
      const receivingRoleRef = parseReference(
        Array.isArray(serviceRequest.performer)
          ? serviceRequest.performer[0]
          : undefined
      );
      const requesterRoleRef = parseReference(serviceRequest.requester);
      const receivingRole = aggregate.practitionerRoles.find(
        (role) => role.id === receivingRoleRef?.id
      );
      const requesterRole = aggregate.practitionerRoles.find(
        (role) => role.id === requesterRoleRef?.id
      );
      const receivingOrganization = aggregate.organizations.find(
        (organization) =>
          parseReference(receivingRole?.organization)?.id === organization.id
      );
      const referringOrganization = aggregate.organizations.find(
        (organization) =>
          parseReference(requesterRole?.organization)?.id === organization.id
      );
      const task = aggregate.task;
      const status = task ? statusFromTask(task) : "requested";
      const authoredOn =
        typeof serviceRequest.authoredOn === "string" ? serviceRequest.authoredOn : now;
      const requestedService = firstCodeable(serviceRequest.code);
      const referralCategory = firstCodeable(serviceRequest.category);
      const clinicalReason = firstCodeable(serviceRequest.reasonCode);
      const priority =
        serviceRequest.priority === "routine" ||
        serviceRequest.priority === "urgent" ||
        serviceRequest.priority === "stat"
          ? serviceRequest.priority
          : "routine";
      const draft: ReferralDraft = {
        referralId:
          (serviceRequest.requisition as { value?: string } | undefined)?.value ??
          serviceRequest.id,
        patientRecordId: aggregate.patient?.id
          ? `remote-patient-${aggregate.patient.id}`
          : "remote-patient",
        authoredOn,
        timeCalled:
          typeof serviceRequest.occurrenceDateTime === "string"
            ? serviceRequest.occurrenceDateTime
            : authoredOn,
        referringPractitioner: {
          given: "Remote",
          family: "Practitioner",
          license: "",
          role: firstCodeable(requesterRole?.code)
        },
        initiatingFacility: {
          name: organizationName(referringOrganization, "Remote referring facility"),
          nhfrCode: firstIdentifier(
            referringOrganization,
            IDENTIFIER_SYSTEMS.nhfr
          ),
          hcpnName: "",
          phone: "",
          address: createEmptyPatient().address,
          source: "fhir",
          fhirReference: referringOrganization?.id
            ? `Organization/${referringOrganization.id}`
            : undefined,
          fhirServerLabel: "PHeReF CDR"
        },
        receivingFacility: {
          name: organizationName(receivingOrganization, currentAccount.organizationName),
          nhfrCode: facility.organization.nhfrCode,
          hcpnName: facility.organization.hcpnName,
          phone: facility.organization.phone,
          address: structuredClone(facility.organization.address),
          source: "fhir",
          fhirReference: receivingOrganization?.id
            ? `Organization/${receivingOrganization.id}`
            : facility.organization.fhirReference,
          fhirServerLabel: "PHeReF CDR"
        },
        patient,
        referralCategory,
        priority,
        requestedService,
        clinicalReason,
        referralNarrative:
          (serviceRequest.note as Array<{ text?: string }> | undefined)?.[0]?.text ??
          requestedService.display,
        remarks:
          (serviceRequest.note as Array<{ text?: string }> | undefined)?.[1]?.text ?? "",
        chiefComplaint:
          (aggregate.conditions[0]?.code as { text?: string } | undefined)?.text ?? "",
        clinicalHistory: String(aggregate.conditions[0]?.note ?? ""),
        workingImpressionText:
          (aggregate.conditions[1]?.code as { text?: string } | undefined)?.text ??
          clinicalReason.display,
        vitals: {
          observedAt: authoredOn,
          systolic: 0,
          diastolic: 0,
          heartRate: 0,
          respiratoryRate: 0,
          oxygenSaturation: 0,
          temperature: 0,
          weight: 0
        },
        treatment:
          (aggregate.procedures[0]?.note as Array<{ text?: string }> | undefined)?.[0]?.text ??
          "",
        labTitle:
          (aggregate.diagnosticReports[0]?.code as { text?: string } | undefined)?.text ??
          "Diagnostic report",
        labConclusion: String(aggregate.diagnosticReports[0]?.conclusion ?? ""),
        labAttachmentBase64: "",
        referralCriteriaSatisfied: true,
        consentGiven: false,
        consentStatement: "",
        signatureBase64: ""
      };
      const resources = [
        serviceRequest,
        aggregate.patient,
        task,
        aggregate.encounter,
        ...aggregate.conditions,
        ...aggregate.observations,
        ...aggregate.procedures,
        ...aggregate.diagnosticReports,
        ...aggregate.provenances,
        ...aggregate.organizations,
        ...aggregate.practitioners,
        ...aggregate.practitionerRoles
      ].filter((resource): resource is FhirResource => Boolean(resource));
      return [
        {
          id: `remote-ServiceRequest-${serviceRequest.id}`,
          localReferralId: draft.referralId,
          patientId: draft.patientRecordId,
          patientName: patientDisplayName(patient) || "Remote patient",
          referringOrganizationId: referringOrganization?.id
            ? `remote-Organization-${referringOrganization.id}`
            : "remote-referring-organization",
          referringOrganizationName: draft.initiatingFacility.name,
          receivingOrganizationId: currentAccount.organizationId,
          receivingOrganizationName: currentAccount.organizationName,
          reason: requestedService.display,
          priority,
          category: referralCategory.display,
          consentGiven: false,
          status,
          taskStatus: String(task?.status ?? status),
          businessStatus: taskBusinessStatus(task),
          createdAt: authoredOn,
          updatedAt: String(task?.lastModified ?? serviceRequest.meta?.lastUpdated ?? now),
          submittedAt: authoredOn,
          validationSummary: emptyValidationSummary(),
          fhirBundle: { resourceType: "Bundle", type: "collection", entry: [] },
          fhirResources: resources,
          resourceReferences: {
            patientReference: aggregate.patient?.id ? `Patient/${aggregate.patient.id}` : undefined,
            serviceRequestReference: `ServiceRequest/${serviceRequest.id}`,
            taskReference: task?.id ? `Task/${task.id}` : undefined,
            encounterReference: aggregate.encounter?.id
              ? `Encounter/${aggregate.encounter.id}`
              : undefined
          },
          draft,
          timeline: [
            createTimelineEvent(
              `remote-ServiceRequest-${serviceRequest.id}`,
              status,
              "Live incoming referral retrieved from the PHeReF CDR.",
              currentAccount
            )
          ],
          liveSubmission: true
        }
      ];
    });
    commit((current) => {
      const existingById = new Map(current.referrals.map((item) => [item.id, item]));
      const merged = records.map((record) => {
        const existing = existingById.get(record.id);
        return existing
          ? {
              ...existing,
              ...record,
              timeline: existing.timeline.length ? existing.timeline : record.timeline
            }
          : record;
      });
      const incomingIds = new Set(records.map((record) => record.id));
      const newRecords = records.filter((record) => !existingById.has(record.id));
      return {
        ...current,
        referrals: [
          ...merged,
          ...current.referrals.filter((record) => !incomingIds.has(record.id))
        ],
        notifications: [
          ...newRecords.map((record) =>
            createNotification(
              record.id,
              currentAccount.organizationId,
              "Live incoming referral found",
              `Live referral for ${record.patientName} from ${record.referringOrganizationName} is assigned to this facility.`
            )
          ),
          ...current.notifications
        ]
      };
    });
    return records.length;
  }

  function markNotificationRead(notificationId: string) {
    commit((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    }));
  }

  function markReferralNotificationsRead(referralId: string) {
    if (!currentAccount) return;
    commit((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.referralId === referralId &&
        notification.targetOrganizationId === currentAccount.organizationId
          ? { ...notification, read: true }
          : notification
      )
    }));
  }

  const scopedPatients = useMemo(
    () =>
      currentAccount?.role === "admin"
        ? state.patients
        : state.patients.filter(
            (patient) => patient.organizationId === currentAccount?.organizationId
          ),
    [state.patients, currentAccount]
  );
  const scopedReferrals = useMemo(
    () => referralsForAccount(state.referrals, currentAccount),
    [state.referrals, currentAccount]
  );
  const sentReferrals = useMemo(
    () => sentReferralsForAccount(state.referrals, currentAccount),
    [state.referrals, currentAccount]
  );
  const incomingReferrals = useMemo(
    () => incomingReferralsForAccount(state.referrals, currentAccount),
    [state.referrals, currentAccount]
  );
  const scopedNotifications = useMemo(
    () => notificationsForAccount(state.notifications, currentAccount),
    [state.notifications, currentAccount]
  );

  return (
    <AppContext.Provider
      value={{
        connectathonConfig: CONNECTATHON_CONFIG,
        accounts,
        facilities,
        registeredFacilities: state.registeredFacilities,
        currentAccount,
        settings: effectiveSettings,
        endpoints: effectiveSettings,
        patients: state.patients,
        scopedPatients,
        referrals: state.referrals,
        scopedReferrals,
        sentReferrals,
        incomingReferrals,
        notifications: state.notifications,
        scopedNotifications,
        unreadNotificationCount: scopedNotifications.filter((item) => !item.read)
          .length,
        login,
        logout,
        setEndpoints,
        resetEndpoints,
        registerFacility,
        selfRegisterFacility,
        publishFacility,
        savePatient,
        linkWalkInPatient,
        draft: activeDraftRecord?.draft ?? null,
        activeDraftRecord,
        startNewReferral,
        setDraft,
        resetDraft,
        cancelDraft,
        saveValidation,
        submitCurrentReferral,
        transitionReferral,
        refreshReferral,
        refreshLiveIncomingReferrals,
        markNotificationRead,
        markReferralNotificationsRead,
        getReferral: (referralId) =>
          scopedReferrals.find((referral) => referral.id === referralId)
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
