import {
  PSGC_SYSTEM,
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
let snapshotPromise: Promise<Record<string, PsgcOption[]>> | null = null;

function expandUrl(baseUrl: string, canonical: string, count: number) {
  const params = new URLSearchParams({
    url: canonical,
    count: String(count)
  });
  return `${baseUrl.replace(/\/$/, "")}/ValueSet/$expand?${params}`;
}

async function loadExpansion(
  baseUrl: string,
  canonical: string,
  count: number,
  signal?: AbortSignal
) {
  const key = `${baseUrl}|${canonical}`;
  if (!expansionCache.has(key)) {
    const request = fetch(expandUrl(baseUrl, canonical, count), {
      headers: { Accept: "application/fhir+json" },
      signal: signal ?? AbortSignal.timeout(90_000)
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
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
        } | null;
        if (!response.ok) {
          throw new Error(
            `PSGC expansion failed (${response.status})${
              body?.resourceType === "OperationOutcome"
                ? " with OperationOutcome"
                : ""
            }`
          );
        }
        const version = body?.version ?? PSGC_VERSION;
        return (body?.expansion?.contains ?? []).flatMap((item) =>
          item.code
            ? [
                {
                  system: item.system ?? PSGC_SYSTEM,
                  version: item.version ?? version,
                  code: item.code,
                  display: (item.display ?? item.code).trim()
                }
              ]
            : []
        );
      })
      .catch(async (error) => {
        if (error instanceof Error && error.name === "AbortError") {
          throw error;
        }
        const snapshot = await loadBundledPsgcSnapshot();
        const fallback = snapshot[canonical];
        if (fallback) return fallback;
        throw error;
      });
    expansionCache.set(
      key,
      request.catch((error) => {
        expansionCache.delete(key);
        throw error;
      })
    );
  }
  return expansionCache.get(key)!;
}

async function loadBundledPsgcSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch(`${import.meta.env.BASE_URL}psgc.generated.json`, {
      headers: { Accept: "application/json" }
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Bundled PSGC snapshot failed (${response.status})`);
      }
      const body = (await response.json()) as {
        system?: string;
        version?: string;
        regions?: Array<{ code: string; display: string }>;
        provinces?: Array<{ code: string; display: string }>;
        cities?: Array<{ code: string; display: string }>;
        barangays?: Array<{ code: string; display: string }>;
      };
      const system = body.system ?? PSGC_SYSTEM;
      const version = body.version ?? PSGC_VERSION;
      const options = (
        rows: Array<{ code: string; display: string }> | undefined
      ): PsgcOption[] =>
        (rows ?? []).map((row) => ({
          system,
          version,
          code: row.code,
          display: row.display.trim()
        }));
      return {
        [PSGC_VALUE_SETS.regions]: options(body.regions),
        [PSGC_VALUE_SETS.provinces]: options(body.provinces),
        [PSGC_VALUE_SETS.cities]: options(body.cities),
        [PSGC_VALUE_SETS.barangays]: options(body.barangays)
      };
    });
  }
  return snapshotPromise;
}

export async function loadPsgcDirectory(
  baseUrl: string,
  signal?: AbortSignal
): Promise<PsgcDirectory> {
  const [regions, provinces, cities] = await Promise.all([
    loadExpansion(baseUrl, PSGC_VALUE_SETS.regions, 100, signal),
    loadExpansion(baseUrl, PSGC_VALUE_SETS.provinces, 200, signal),
    loadExpansion(baseUrl, PSGC_VALUE_SETS.cities, 2_000, signal)
  ]);
  return { regions, provinces, cities };
}

export function loadPsgcBarangays(baseUrl: string, signal?: AbortSignal) {
  return loadExpansion(baseUrl, PSGC_VALUE_SETS.barangays, 50_000, signal);
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
  snapshotPromise = null;
}
