import { useState, type PropsWithChildren } from "react";
import { createDemoDraft } from "../data/demo";
import { storage } from "../services/storage";
import type { EndpointConfig, ReferralDraft } from "../types";
import { AppContext } from "./appContextValue";

export function AppProvider({ children }: PropsWithChildren) {
  const [endpoints, setEndpointState] = useState(storage.loadEndpoints);
  const [draft, setDraftState] = useState(() => storage.loadDraft() ?? createDemoDraft());

  const setEndpoints = (value: EndpointConfig) => {
    setEndpointState(value);
    storage.saveEndpoints(value);
  };
  const resetEndpoints = () => setEndpointState(storage.resetEndpoints());
  const setDraft = (value: ReferralDraft) => {
    setDraftState(value);
    storage.saveDraft(value);
  };
  const resetDraft = () => {
    const value = createDemoDraft();
    setDraft(value);
  };

  return (
    <AppContext.Provider
      value={{ endpoints, setEndpoints, resetEndpoints, draft, setDraft, resetDraft }}
    >
      {children}
    </AppContext.Provider>
  );
}
