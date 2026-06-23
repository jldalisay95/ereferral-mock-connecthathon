import { createContext } from "react";
import type {
  AppSettings,
  FacilityAccount,
  FacilityDefinition,
  Notification,
  PatientInput,
  PatientRecord,
  ReferralDraft,
  ReferralRecord,
  RegistryType,
  TaskTransition,
  ValidationSummary
} from "../types";

export interface AppContextValue {
  accounts: FacilityAccount[];
  facilities: FacilityDefinition[];
  currentAccount: FacilityAccount | null;
  settings: AppSettings;
  endpoints: AppSettings;
  patients: PatientRecord[];
  scopedPatients: PatientRecord[];
  referrals: ReferralRecord[];
  scopedReferrals: ReferralRecord[];
  sentReferrals: ReferralRecord[];
  incomingReferrals: ReferralRecord[];
  notifications: Notification[];
  scopedNotifications: Notification[];
  unreadNotificationCount: number;
  login: (username: string, password: string) => void;
  logout: () => void;
  setEndpoints: (value: AppSettings) => void;
  resetEndpoints: () => void;
  savePatient: (
    patient: PatientInput,
    registryType: RegistryType,
    notes: string,
    existingId?: string
  ) => PatientRecord;
  linkWalkInPatient: (walkInId: string, patientId: string) => void;
  draft: ReferralDraft | null;
  activeDraftRecord: ReferralRecord | null;
  startNewReferral: (patientId: string) => string;
  setDraft: (value: ReferralDraft) => void;
  resetDraft: () => void;
  cancelDraft: () => void;
  saveValidation: (
    summary: ValidationSummary,
    outcome?: ReferralRecord["validationOutcome"]
  ) => void;
  submitCurrentReferral: (allowBlocking: boolean) => Promise<ReferralRecord>;
  transitionReferral: (
    referralId: string,
    transition: TaskTransition,
    note: string,
    forwardingFacilityId?: string
  ) => Promise<ReferralRecord>;
  refreshReferral: (referralId: string) => Promise<ReferralRecord>;
  markNotificationRead: (notificationId: string) => void;
  markReferralNotificationsRead: (referralId: string) => void;
  getReferral: (referralId: string) => ReferralRecord | undefined;
}

export const AppContext = createContext<AppContextValue | null>(null);
