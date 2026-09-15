import { useEffect, useMemo, useState } from "react";
import { CONNECTATHON_CONFIG } from "../config/connectathon.config";
import { useAppContext } from "../context/useAppContext";
import { expandValueSet } from "../services/terminologyClient";
import type { CodingInput } from "../types";

export type TerminologySource = "server" | "fallback" | "none";

export interface TerminologyValueSetState {
  canonical: string;
  label: string;
  status: "loading" | "ready" | "error";
  source: TerminologySource;
  options: CodingInput[];
  error?: string;
  requiresLiveExpansion: boolean;
}

export function useTerminologyValueSet(key: string): TerminologyValueSetState {
  const { endpoints } = useAppContext();
  const definition = useMemo(
    () => CONNECTATHON_CONFIG.terminology.valueSets.find((item) => item.key === key),
    [key]
  );
  if (!definition) throw new Error(`Unknown terminology configuration key: ${key}`);

  const requiresLiveExpansion = CONNECTATHON_CONFIG.preset === "ready";
  const fallback = useMemo(
    () => definition.fallbackOptions.map((option) => ({ ...option })),
    [definition]
  );
  const [state, setState] = useState<Omit<TerminologyValueSetState, "canonical" | "label" | "requiresLiveExpansion">>({
    status: "loading",
    source: requiresLiveExpansion ? "none" : "fallback",
    options: requiresLiveExpansion ? [] : fallback
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({
      status: "loading",
      source: requiresLiveExpansion ? "none" : "fallback",
      options: requiresLiveExpansion ? [] : fallback
    });
    expandValueSet(
      endpoints.terminologyBaseUrl,
      definition.canonical,
      controller.signal
    )
      .then((result) => {
        setState({ status: "ready", source: "server", options: result.codes });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          source: requiresLiveExpansion ? "none" : "fallback",
          options: requiresLiveExpansion ? [] : fallback,
          error: error instanceof Error ? error.message : "ValueSet expansion failed."
        });
      });
    return () => controller.abort();
  }, [definition, endpoints.terminologyBaseUrl, fallback, requiresLiveExpansion]);

  return {
    ...state,
    canonical: definition.canonical,
    label: definition.label,
    requiresLiveExpansion
  };
}
