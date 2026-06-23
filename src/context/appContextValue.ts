import { createContext } from "react";
import type { EndpointConfig, ReferralDraft } from "../types";

export interface AppContextValue {
  endpoints: EndpointConfig;
  setEndpoints: (value: EndpointConfig) => void;
  resetEndpoints: () => void;
  draft: ReferralDraft;
  setDraft: (value: ReferralDraft) => void;
  resetDraft: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);
