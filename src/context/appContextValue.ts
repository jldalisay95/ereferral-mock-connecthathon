import { createContext } from "react";
import type {
  AppSettings,
  FacilityAccount,
  FacilityDefinition,
  Notification,
  ReferralDraft,
  ReferralRecord,
  TaskTransition,
  ValidationSummary
} from "../types";

export interface AppContextValue {
  accounts: FacilityAccount[];
  facilities: FacilityDefinition[];
  currentAccount: FacilityAccount | null;
  settings: AppSettings;
  endpoints: AppSettings;
  referrals: ReferralRecord[];
  scopedReferrals: ReferralRecord[];
  notifications: Notification[];
  scopedNotifications: Notification[];
  unreadNotificationCount: number;
  login: (accountId: string) => void;
  logout: () => void;
  setEndpoints: (value: AppSettings) => void;
  resetEndpoints: () => void;
  draft: ReferralDraft | null;
  activeDraftRecord: ReferralRecord | null;
  startNewReferral: () => string;
  setDraft: (value: ReferralDraft) => void;
  resetDraft: () => void;
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
