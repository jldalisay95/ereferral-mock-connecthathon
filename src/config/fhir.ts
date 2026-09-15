// Compatibility exports for existing builders and forms. Participant-editable
// conformance values live in connectathon.config.ts.
import { CONNECTATHON_CONFIG } from "./connectathon.config";

export {
  CONNECTATHON_CONFIG,
  CONNECTATHON_PRESET,
  assertExternalWritesAllowed
} from "./connectathon.config";
export type {
  ConnectathonCapabilities,
  ConnectathonConfig,
  ConnectathonPresetName,
  ConformanceValueSet
} from "./connectathon.config";

export const DEFAULT_ENDPOINTS = CONNECTATHON_CONFIG.endpoints;
export const PROFILES = CONNECTATHON_CONFIG.profiles;
export const IDENTIFIER_SYSTEMS = CONNECTATHON_CONFIG.identifierSystems;
export const EXTENSIONS = CONNECTATHON_CONFIG.extensions;
export const PSGC_SYSTEM = CONNECTATHON_CONFIG.codeSystems.psgc;
export const PSGC_CODE_SYSTEM_ID = CONNECTATHON_CONFIG.psgc.codeSystemId;
export const PSGC_VERSION = CONNECTATHON_CONFIG.psgc.version;
export const PSGC_VALUE_SETS = CONNECTATHON_CONFIG.psgc.valueSets;
export const PSGC_VALUE_SET_IDS = CONNECTATHON_CONFIG.psgc.valueSetIds;
export const REFERRAL_CATEGORY_OPTIONS = CONNECTATHON_CONFIG.terminology.referralCategories;
export const REQUESTED_SERVICE_OPTIONS = CONNECTATHON_CONFIG.terminology.requestedServices;
export const REFERRAL_PRIORITY_OPTIONS = CONNECTATHON_CONFIG.terminology.priorities;
export const CLINICAL_REASON_OPTIONS = CONNECTATHON_CONFIG.terminology.clinicalReasons;
export const RELATIONSHIP_OPTIONS = CONNECTATHON_CONFIG.terminology.relationships;
export const PWD_DISABILITY_OPTIONS = CONNECTATHON_CONFIG.terminology.disabilities;
export const VALUE_SETS = CONNECTATHON_CONFIG.terminology.valueSets;
