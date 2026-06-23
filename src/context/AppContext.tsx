import { useMemo, useState, type PropsWithChildren } from "react";
import { DEFAULT_ENDPOINTS } from "../config/fhir";
import { DEMO_ACCOUNTS, FACILITIES, findAccount, findFacility } from "../data/facilities";
import { createDemoDraft } from "../data/demo";
import { applyTaskTransition } from "../fhir/taskTransitions";
import {
  parseTransactionResponse,
  readResource,
  submitTransactionBundle,
  updateResource
} from "../services/fhirClient";
import { findResource, resolveTransactionBundle } from "../services/demoFhir";
import {
  createNotification,
  localRepository
} from "../services/localRepository";
import {
  createDraftRecord,
  createTimelineEvent,
  notificationsForAccount,
  referralsForAccount,
  updateDraftRecord
} from "../services/referralRecords";
import type {
  AppSettings,
  FhirResource,
  PersistedAppState,
  ReferralDraft,
  ReferralRecord,
  ReferralStatus,
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

function statusFromTask(task: FhirResource): ReferralStatus {
  const businessCode = (
    task.businessStatus as { coding?: Array<{ code?: string }> } | undefined
  )?.coding?.[0]?.code;
  if (businessCode === "referred-onward") return "referred-onward";
  const status = String(task.status ?? "requested");
  return status === "received" ||
    status === "accepted" ||
    status === "rejected" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "in-progress"
    ? status
    : "requested";
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

  function login(accountId: string) {
    const account = findAccount(accountId);
    if (!account) throw new Error("Unknown demo account.");
    commit((current) => ({
      ...current,
      session: { userId: account.id, loggedInAt: new Date().toISOString() }
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
      settings: { version: 2, ...DEFAULT_ENDPOINTS }
    }));
  }

  function startNewReferral(): string {
    if (!currentAccount || currentAccount.role !== "referring_facility_user") {
      throw new Error("Only referring-facility users can create referrals.");
    }
    const referring = findFacility(currentAccount.organizationId);
    const receiving = FACILITIES.find((facility) => facility.id !== currentAccount.organizationId);
    if (!referring || !receiving) throw new Error("Demo facility configuration is incomplete.");
    const record = createDraftRecord(
      createDemoDraft(referring, receiving),
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
    const receiving = FACILITIES.find(
      (facility) => facility.organization.nhfrCode === draft.receivingFacility.nhfrCode
    );
    commit((current) => ({
      ...current,
      referrals: current.referrals.map((record) =>
        record.id === activeDraftRecord.id
          ? updateDraftRecord(record, draft, receiving?.id ?? record.receivingOrganizationId)
          : record
      )
    }));
  }

  function resetDraft() {
    if (!currentAccount || !activeDraftRecord) return;
    const referring = findFacility(currentAccount.organizationId);
    const receiving =
      findFacility(activeDraftRecord.receivingOrganizationId) ??
      FACILITIES.find((facility) => facility.id !== currentAccount.organizationId);
    if (referring && receiving) setDraft(createDemoDraft(referring, receiving));
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

  async function submitCurrentReferral(allowBlocking: boolean): Promise<ReferralRecord> {
    if (!currentAccount || !activeDraftRecord) throw new Error("No active referral draft.");
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
            : "Referral transaction submitted to the PHeRef CDR.",
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
      notifications: [
        createNotification(
          updated.id,
          updated.receivingOrganizationId,
          "New referral received",
          `${updated.patientName} was referred by ${updated.referringOrganizationName}.`
        ),
        ...current.notifications
      ]
    }));
    return updated;
  }

  async function transitionReferral(
    referralId: string,
    transition: TaskTransition,
    note: string,
    forwardingFacilityId?: string
  ): Promise<ReferralRecord> {
    if (!currentAccount || currentAccount.role !== "receiving_facility_user") {
      throw new Error("Only receiving-facility users can update referral workflow status.");
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
    if (!taskId || !storedTask) throw new Error("The referral does not have a Task resource.");

    try {
      const sourceTask = record.liveSubmission
        ? await readResource(state.settings.pherefBaseUrl, "Task", taskId)
        : storedTask;
      const effectiveNote =
        note.trim() ||
        (transition === "received"
          ? "Referral received by receiving facility."
          : transition === "accepted"
            ? "Referral accepted."
            : transition === "completed"
              ? "Referral completed."
              : note);
      const updatedTask = applyTaskTransition(sourceTask, transition, effectiveNote);
      const savedTask = record.liveSubmission
        ? await updateResource(
            state.settings.pherefBaseUrl,
            "Task",
            taskId,
            updatedTask
          )
        : updatedTask;
      const status = statusFromTask(savedTask);
      const forwardingFacility = forwardingFacilityId
        ? findFacility(forwardingFacilityId)
        : undefined;
      const now = new Date().toISOString();
      const updated: ReferralRecord = {
        ...record,
        status,
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
            status,
            transition === "referred-onward" && forwardingFacility
              ? `Forwarded to ${forwardingFacility.name}. ${effectiveNote}`
              : effectiveNote,
            currentAccount
          )
        ]
      };
      commit((current) => ({
        ...current,
        referrals: current.referrals.map((item) => (item.id === updated.id ? updated : item)),
        notifications: [
          createNotification(
            updated.id,
            updated.referringOrganizationId,
            `Referral ${status}`,
            `${updated.receivingOrganizationName} updated ${updated.patientName}'s referral to ${status}.`
          ),
          ...current.notifications.map((notification) =>
            notification.referralId === updated.id &&
            notification.receivingOrganizationId === currentAccount.organizationId
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
      updatedAt: String(task.lastModified ?? new Date().toISOString()),
      fhirResources: record.fhirResources.map((resource) =>
        resource.resourceType === "Task" ? task : resource
      )
    };
    commit((current) => ({
      ...current,
      referrals: current.referrals.map((item) => (item.id === updated.id ? updated : item))
    }));
    return updated;
  }

  function markNotificationRead(notificationId: string) {
    commit((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    }));
  }

  function markReferralNotificationsRead(referralId: string) {
    if (!currentAccount) return;
    commit((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.referralId === referralId &&
        notification.receivingOrganizationId === currentAccount.organizationId
          ? { ...notification, read: true }
          : notification
      )
    }));
  }

  const scopedReferrals = useMemo(
    () => referralsForAccount(state.referrals, currentAccount),
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
        referrals: state.referrals,
        scopedReferrals,
        notifications: state.notifications,
        scopedNotifications,
        unreadNotificationCount: scopedNotifications.filter((item) => !item.read).length,
        login,
        logout,
        setEndpoints,
        resetEndpoints,
        draft: activeDraftRecord?.draft ?? null,
        activeDraftRecord,
        startNewReferral,
        setDraft,
        resetDraft,
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
