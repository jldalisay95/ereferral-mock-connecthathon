import {
  CONNECTATHON_CONFIG,
  PSGC_SYSTEM,
  PSGC_VALUE_SET_IDS,
  PSGC_VALUE_SETS,
  PSGC_VERSION
} from "../config/fhir";

export interface PsgcOption {
  system: string;
  version: string;
  code: string;
  display: string;
}

export interface PsgcDirectory {
  regions: PsgcOption[];
  provinces: PsgcOption[];
  cities: PsgcOption[];
}

const expansionCache = new Map<string, Promise<PsgcOption[]>>();

interface ExpansionResponse {
  resourceType?: string;
  version?: string;
  expansion?: {
    contains?: Array<{
      system?: string;
      version?: string;
      code?: string;
      display?: string;
    }>;
  };
}

function valueSetExpandUrl(baseUrl: string, valueSetId: string, count: number) {
  const params = new URLSearchParams({ count: String(count) });
  return `${baseUrl.replace(/\/$/, "")}/ValueSet/${valueSetId}/$expand?${params}`;
}

export function codeSystemLookupUrl(baseUrl: string, system = PSGC_SYSTEM) {
  const params = new URLSearchParams({ url: system });
  return `${baseUrl.replace(/\/$/, "")}/CodeSystem?${params}`;
}

export function valueSetLookupUrl(baseUrl: string, canonical: string) {
  const params = new URLSearchParams({ url: canonical });
  return `${baseUrl.replace(/\/$/, "")}/ValueSet?${params}`;
}

function canonicalExpandUrl(baseUrl: string, canonical: string, count: number) {
  const params = new URLSearchParams({
    url: canonical,
    count: String(count)
  });
  return `${baseUrl.replace(/\/$/, "")}/ValueSet/$expand?${params}`;
}

async function fetchExpansion(url: string, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, {
    headers: { Accept: "application/fhir+json" },
    signal: timeout
  });
  const body = (await response.json().catch(() => null)) as
    | ExpansionResponse
    | null;
  if (!response.ok) {
    throw new Error(
      `PSGC expansion failed (${response.status})${
        body?.resourceType === "OperationOutcome" ? " with OperationOutcome" : ""
      }`
    );
  }
  const codes = (body?.expansion?.contains ?? []).flatMap((item) =>
    item.code
      ? [
          {
            system: item.system ?? PSGC_SYSTEM,
            // ValueSet.version identifies the ValueSet, not necessarily the
            // CodeSystem used by an expansion entry. Only an entry-level
            // version can override the configured PSGC CodeSystem version.
            version: item.version ?? PSGC_VERSION,
            code: item.code,
            display: item.display ?? item.code
          }
        ]
      : []
  );
  if (!codes.length) {
    throw new Error(`PSGC terminology expansion returned no codes from ${url}.`);
  }
  return codes;
}

function waitForExpansion<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException("The PSGC request was aborted.", "AbortError")
    );
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("The PSGC request was aborted.", "AbortError")
      );
    signal.addEventListener("abort", abort, { once: true });
    request.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
}

async function loadExpansion(
  baseUrl: string,
  valueSetId: string,
  canonical: string,
  count: number,
  signal?: AbortSignal
) {
  const key = [
    CONNECTATHON_CONFIG.preset,
    CONNECTATHON_CONFIG.ig.version,
    PSGC_VERSION,
    baseUrl,
    valueSetId,
    canonical
  ].join("|");
  if (!expansionCache.has(key)) {
    // Large PSGC expansions need more time than ordinary coded fields. The
    // shared request deliberately does not use a component's abort signal:
    // React development remounts must not poison the cache for the next load.
    const timeoutMs = count >= 50_000 ? 90_000 : 30_000;
    const request = fetchExpansion(canonicalExpandUrl(baseUrl, canonical, count), timeoutMs)
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") throw error;
        return fetchExpansion(valueSetExpandUrl(baseUrl, valueSetId, count), timeoutMs);
      });
    expansionCache.set(
      key,
      request.catch((error) => {
        expansionCache.delete(key);
        throw error;
      })
    );
  }
  return waitForExpansion(expansionCache.get(key)!, signal);
}

export async function loadPsgcDirectory(
  baseUrl: string,
  signal?: AbortSignal
): Promise<PsgcDirectory> {
  // Some Connectathon terminology servers throttle simultaneous expansions.
  // Load the three hierarchy levels in sequence to avoid a failing request burst.
  const regions = await loadExpansion(
    baseUrl,
    PSGC_VALUE_SET_IDS.regions,
    PSGC_VALUE_SETS.regions,
    100,
    signal
  );
  const provinces = await loadExpansion(
    baseUrl,
    PSGC_VALUE_SET_IDS.provinces,
    PSGC_VALUE_SETS.provinces,
    200,
    signal
  );
  const cities = await loadExpansion(
    baseUrl,
    PSGC_VALUE_SET_IDS.cities,
    PSGC_VALUE_SETS.cities,
    2_000,
    signal
  );
  return { regions, provinces, cities };
}

export function loadPsgcBarangays(
  baseUrl: string,
  signal?: AbortSignal
) {
  return loadExpansion(
    baseUrl,
    PSGC_VALUE_SET_IDS.barangays,
    PSGC_VALUE_SETS.barangays,
    50_000,
    signal
  );
}

export function loadAllPsgc(
  baseUrl: string,
  signal?: AbortSignal
) {
  return loadExpansion(
    baseUrl,
    PSGC_VALUE_SET_IDS.all,
    PSGC_VALUE_SETS.all,
    50_000,
    signal
  );
}

export function provincesForRegion(
  provinces: PsgcOption[],
  regionCode: string
) {
  const prefix = regionCode.slice(0, 2);
  return provinces.filter((option) => option.code.startsWith(prefix));
}

export function citiesForLocation(
  cities: PsgcOption[],
  regionCode: string,
  provinceCode: string
) {
  const prefix = provinceCode
    ? provinceCode.slice(0, 5)
    : regionCode.slice(0, 2);
  return cities.filter((option) => option.code.startsWith(prefix));
}

export function barangaysForCity(
  barangays: PsgcOption[],
  cityCode: string
) {
  const prefix = cityCode.slice(0, 7);
  return barangays.filter((option) => option.code.startsWith(prefix));
}

export function clearPsgcDirectoryCache() {
  expansionCache.clear();
}
