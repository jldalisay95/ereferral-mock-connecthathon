import { DEFAULT_ENDPOINTS } from "../config/fhir";
import type { EndpointConfig, ReferralDraft, SubmissionReceipt } from "../types";

const KEYS = {
  draft: "pheref.referralDraft",
  endpoints: "pheref.endpoints",
  receipts: "pheref.receipts"
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const storage = {
  loadDraft: () => readJson<ReferralDraft | null>(KEYS.draft, null),
  saveDraft: (draft: ReferralDraft) =>
    localStorage.setItem(KEYS.draft, JSON.stringify(draft)),
  clearDraft: () => localStorage.removeItem(KEYS.draft),
  loadEndpoints: () => readJson<EndpointConfig>(KEYS.endpoints, DEFAULT_ENDPOINTS),
  saveEndpoints: (endpoints: EndpointConfig) =>
    localStorage.setItem(KEYS.endpoints, JSON.stringify(endpoints)),
  resetEndpoints: () => {
    localStorage.removeItem(KEYS.endpoints);
    return DEFAULT_ENDPOINTS;
  },
  loadReceipts: () => readJson<SubmissionReceipt[]>(KEYS.receipts, []),
  saveReceipt: (receipt: SubmissionReceipt) => {
    const receipts = readJson<SubmissionReceipt[]>(KEYS.receipts, []);
    localStorage.setItem(KEYS.receipts, JSON.stringify([receipt, ...receipts].slice(0, 20)));
  }
};
