import { useMemo, useState, type PropsWithChildren } from "react";
import { DEFAULT_ENDPOINTS } from "../config/fhir";
import {
  DEMO_ACCOUNTS,
  FACILITIES,
  authenticateAccount,
  findAccount,
  findFacility
} from "../data/facilities";
import { createDemoDraft } from "../data/demo";
import { applyTaskTransition } from "../fhir/taskTransitions";
import {
  parseTransactionResponse,
  readResource,
  submitTransactionBundle,
  updateResource
} from "../services/fhirClient";
import { findResource, resolveTransactionBundle } from "../services/demoFhir";
import { createNotification, localRepository } from "../services/localRepository";
import { organizationDestinationId } from "../services/organizationDirectory";
import { createPatientRecord } from "../services/patientRegistry";
import { assertReferralSubmissionReady } from "../services/referralValidation";
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
  const currentAccount = state.session ? findAccount(state.session.userId) ?? null : null;
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
    const account = authenticateAccount(username, password);
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
    commit((current) => ({ ...current, settings }));
  }

  function resetEndpoints() {
    commit((current) => ({
      ...current,
      settings: { version: 3, ...DEFAULT_ENDPOINTS }
    }));
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
    const referring = findFacility(currentAccount.organizationId);
    const receiving = FACILITIES.find(
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
      : FACILITIES.find(
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
    const referring = findFacility(currentAccount.organizationId);
    const receiving =
      findFacility(activeDraftRecord.receivingOrganizationId) ??
      FACILITIES.find((facility) => facility.id !== currentAccount.organizationId);
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

  async function submitCurrentReferral(
    allowBlocking: boolean
  ): Promise<ReferralRecord> {
    if (!currentAccount || !activeDraftRecord) {
      throw new Error("No active referral draft.");
    }
    assertReferralSubmissionReady(activeDraftRecord.draft);
    if (activeDraftRecord.validationSummary.blocking && !allowBlocking) {
      throw new Error("Validation contains blocking issues.");
    }
    const bundle = activeDraftRecord.fhirBundle;
    const remoteResponse = state.settings.demoMode
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
      liveSubmission: !state.settings.demoMode,
      timeline: [
        ...activeDraftRecord.timeline,
        createTimelineEvent(
          activeDraftRecord.id,
          "submitted",
          state.settings.demoMode
            ? "Referral submitted to the local Connectathon demo store."
            : "Referral transaction submitted to the PHeReF CDR.",
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
    const localDestination = FACILITIES.some(
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
    forwardingFacilityId?: string
  ): Promise<ReferralRecord> {
    if (!currentAccount || currentAccount.role !== "facility_user") {
      throw new Error("A facility user is required to update referral status.");
    }
    const record = state.referrals.find((item) => item.id === referralId);
    if (!record || record.receivingOrganizationId !== currentAccount.organizationId) {
      throw new Error("Referral is not assigned to the current facility.");
    }
    if (transition === "referred-onward" && !forwardingFacilityId) {
      throw new Error("A forwarding facility is required.");
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
        effectiveNote
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
        ? findFacility(forwardingFacilityId)
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
        forwardedToOrganizationId: forwardingFacility?.id,
        forwardedToOrganizationName: forwardingFacility?.name,
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
      commit((current) => ({
        ...current,
        referrals: current.referrals.map((item) =>
          item.id === updated.id ? updated : item
        ),
        notifications: [
          createNotification(
            updated.id,
            updated.referringOrganizationId,
            `Referral ${careStatus ?? status}`,
            `${updated.receivingOrganizationName} updated ${updated.patientName}'s referral.`
          ),
          ...current.notifications.map((notification) =>
            notification.referralId === updated.id &&
            notification.targetOrganizationId === currentAccount.organizationId
              ? { ...notification, read: true }
              : notification
          )
        ]
      }));
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
        accounts: DEMO_ACCOUNTS,
        facilities: FACILITIES,
        currentAccount,
        settings: state.settings,
        endpoints: state.settings,
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
