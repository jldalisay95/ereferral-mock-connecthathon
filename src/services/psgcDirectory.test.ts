import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PSGC_SYSTEM,
  PSGC_VALUE_SET_IDS,
  PSGC_VALUE_SETS,
  PSGC_VERSION
} from "../config/fhir";
import {
  barangaysForCity,
  citiesForLocation,
  clearPsgcDirectoryCache,
  codeSystemLookupUrl,
  loadAllPsgc,
  loadPsgcBarangays,
  loadPsgcDirectory,
  provincesForRegion,
  valueSetLookupUrl
} from "./psgcDirectory";

const expansions: Record<string, Array<{ code: string; display: string }>> = {
  [PSGC_VALUE_SET_IDS.regions]: [
    { code: "0600000000", display: "Region VI (Western Visayas)" },
    { code: "1200000000", display: "Region XII (SOCCSKSARGEN)" }
  ],
  [PSGC_VALUE_SET_IDS.provinces]: [
    { code: "0600400000", display: "Aklan" },
    { code: "1206300000", display: "South Cotabato" }
  ],
  [PSGC_VALUE_SET_IDS.cities]: [
    { code: "0600407000", display: "Kalibo " },
    { code: "1206306000", display: "City of Koronadal " }
  ],
  [PSGC_VALUE_SET_IDS.barangays]: [
    { code: "0600407013", display: "Poblacion" },
    { code: "1206306018", display: "Zone III " }
  ],
  [PSGC_VALUE_SET_IDS.all]: [
    { code: "1200000000", display: "Region XII (SOCCSKSARGEN)" },
    { code: "1206300000", display: "South Cotabato" },
    { code: "1206306000", display: "City of Koronadal" },
    { code: "1206306018", display: "Zone III " }
  ]
};

function valueSetIdFromRequest(input: unknown) {
  const url = new URL(String(input));
  const match = url.pathname.match(/\/ValueSet\/([^/]+)\/\$expand$/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const canonical = url.searchParams.get("url");
  const valueSetKey = Object.entries(PSGC_VALUE_SETS).find(
    ([, value]) => value === canonical
  )?.[0] as keyof typeof PSGC_VALUE_SET_IDS | undefined;
  return valueSetKey ? PSGC_VALUE_SET_IDS[valueSetKey] : undefined;
}

describe("PSGC directory", () => {
  beforeEach(() => {
    clearPsgcDirectoryCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input) => {
        const valueSetId = valueSetIdFromRequest(input) ?? "";
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "ValueSet",
            version: PSGC_VERSION,
            expansion: {
              contains: (expansions[valueSetId] ?? []).map((item) => ({
                system: PSGC_SYSTEM,
                ...item
              }))
            }
          })
        } as Response;
      })
    );
  });

  it("loads controlled PSGC value sets without modifying server display text", async () => {
    const directory = await loadPsgcDirectory("https://tx.example.test/fhir");
    const barangays = await loadPsgcBarangays(
      "https://tx.example.test/fhir"
    );
    expect(directory.cities[1]).toEqual(
      expect.objectContaining({
        code: "1206306000",
        display: "City of Koronadal ",
        version: PSGC_VERSION
      })
    );
    expect(barangays[1].display).toBe("Zone III ");
    expect(fetch).toHaveBeenCalledWith(
      `https://tx.example.test/fhir/ValueSet/$expand?url=${encodeURIComponent(
        PSGC_VALUE_SETS.regions
      )}&count=100`,
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      `https://tx.example.test/fhir/ValueSet/$expand?url=${encodeURIComponent(
        PSGC_VALUE_SETS.barangays
      )}&count=50000`,
      expect.any(Object)
    );
  });

  it("loads directory hierarchy expansions sequentially", async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeRequests -= 1;
      const valueSetId = valueSetIdFromRequest(input) ?? "";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "ValueSet",
          expansion: {
            contains: (expansions[valueSetId] ?? []).map((item) => ({
              system: PSGC_SYSTEM,
              ...item
            }))
          }
        })
      } as Response;
    });

    await loadPsgcDirectory("https://tx-sequential.example.test/fhir");

    expect(maximumActiveRequests).toBe(1);
  });

  it("does not let an aborted component subscriber poison the shared cache", async () => {
    let releaseRegions!: (response: Response) => void;
    const regionsResponse = new Promise<Response>((resolve) => {
      releaseRegions = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      const valueSetId = valueSetIdFromRequest(input) ?? "";
      if (valueSetId === PSGC_VALUE_SET_IDS.regions) return regionsResponse;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "ValueSet",
          expansion: {
            contains: (expansions[valueSetId] ?? []).map((item) => ({
              system: PSGC_SYSTEM,
              ...item
            }))
          }
        })
      } as Response;
    });

    const firstController = new AbortController();
    const firstLoad = loadPsgcDirectory(
      "https://tx-remount.example.test/fhir",
      firstController.signal
    );
    firstController.abort();
    const remountedLoad = loadPsgcDirectory("https://tx-remount.example.test/fhir");
    releaseRegions({
      ok: true,
      status: 200,
      json: async () => ({
        resourceType: "ValueSet",
        expansion: {
          contains: expansions[PSGC_VALUE_SET_IDS.regions].map((item) => ({
            system: PSGC_SYSTEM,
            ...item
          }))
        }
      })
    } as Response);

    await expect(firstLoad).rejects.toMatchObject({ name: "AbortError" });
    await expect(remountedLoad).resolves.toMatchObject({
      regions: expect.any(Array),
      provinces: expect.any(Array),
      cities: expect.any(Array)
    });
  });

  it("does not use the ValueSet version as the PSGC CodeSystem version", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const valueSetId = valueSetIdFromRequest(input) ?? "";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "ValueSet",
          version: "2Q-2026",
          expansion: {
            contains: (expansions[valueSetId] ?? []).map((item) => ({
              system: PSGC_SYSTEM,
              ...item
            }))
          }
        })
      } as Response;
    });

    const directory = await loadPsgcDirectory("https://tx.example.test/fhir");

    expect(directory.regions[0].version).toBe(PSGC_VERSION);
    expect(directory.regions[0].version).not.toBe("2Q-2026");
  });

  it("loads the full PSGC value set through canonical URL expansion", async () => {
    const allPsgc = await loadAllPsgc("https://tx.example.test/fhir");
    expect(allPsgc.map((option) => option.code)).toContain("1206306018");
    expect(fetch).toHaveBeenCalledWith(
      `https://tx.example.test/fhir/ValueSet/$expand?url=${encodeURIComponent(
        PSGC_VALUE_SETS.all
      )}&count=50000`,
      expect.any(Object)
    );
  });

  it("builds canonical URL search lookups for PSGC terminology resources", () => {
    expect(codeSystemLookupUrl("https://tx.example.test/fhir")).toBe(
      `https://tx.example.test/fhir/CodeSystem?url=${encodeURIComponent(
        PSGC_SYSTEM
      )}`
    );
    expect(
      valueSetLookupUrl("https://tx.example.test/fhir", PSGC_VALUE_SETS.all)
    ).toBe(
      `https://tx.example.test/fhir/ValueSet?url=${encodeURIComponent(
        PSGC_VALUE_SETS.all
      )}`
    );
  });

  it("filters dependent province, city, and barangay choices by PSGC hierarchy", async () => {
    const directory = await loadPsgcDirectory("https://tx.example.test/fhir");
    const barangays = await loadPsgcBarangays(
      "https://tx.example.test/fhir"
    );
    expect(
      provincesForRegion(directory.provinces, "1200000000").map(
        (option) => option.code
      )
    ).toEqual(["1206300000"]);
    expect(
      citiesForLocation(
        directory.cities,
        "1200000000",
        "1206300000"
      ).map((option) => option.code)
    ).toEqual(["1206306000"]);
    expect(
      barangaysForCity(barangays, "1206306000").map(
        (option) => option.code
      )
    ).toEqual(["1206306018"]);
  });

  it("fails closed when live PSGC terminology is unavailable", async () => {
    clearPsgcDirectoryCache();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(
      loadPsgcDirectory("https://tx.example.test/fhir")
    ).rejects.toThrow("Failed to fetch");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
