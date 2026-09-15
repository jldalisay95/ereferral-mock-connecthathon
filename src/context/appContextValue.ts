import { createContext } from "react";
import type { ConnectathonConfig } from "../config/connectathon.config";
import type {
  AppSettings,
  FacilityAccount,
  FacilityDefinition,
  FacilityPublishResult,
  FacilityRegistrationInput,
  FacilityRegistrationResult,
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
  connectathonConfig: ConnectathonConfig;
  accounts: FacilityAccount[];
  facilities: FacilityDefinition[];
  registeredFacilities: FacilityDefinition[];
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
  registerFacility: (value: FacilityRegistrationInput) => FacilityRegistrationResult;
  selfRegisterFacility: (value: FacilityRegistrationInput) => FacilityRegistrationResult;
  publishFacility: (facilityId: string) => Promise<FacilityPublishResult>;
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
  submitCurrentReferral: () => Promise<ReferralRecord>;
  transitionReferral: (
    referralId: string,
    transition: TaskTransition,
    note: string,
    forwardingFacilityId?: string
  ) => Promise<ReferralRecord>;
  refreshReferral: (referralId: string) => Promise<ReferralRecord>;
  refreshLiveIncomingReferrals: () => Promise<number>;
  markNotificationRead: (notificationId: string) => void;
  markReferralNotificationsRead: (referralId: string) => void;
  getReferral: (referralId: string) => ReferralRecord | undefined;
}

export const AppContext = createContext<AppContextValue | null>(null);
