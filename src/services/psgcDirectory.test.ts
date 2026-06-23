import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PSGC_SYSTEM,
  PSGC_VALUE_SETS,
  PSGC_VERSION
} from "../config/fhir";
import {
  barangaysForCity,
  citiesForLocation,
  clearPsgcDirectoryCache,
  loadPsgcBarangays,
  loadPsgcDirectory,
  provincesForRegion
} from "./psgcDirectory";

const expansions: Record<string, Array<{ code: string; display: string }>> = {
  [PSGC_VALUE_SETS.regions]: [
    { code: "0600000000", display: "Region VI (Western Visayas)" },
    { code: "1200000000", display: "Region XII (SOCCSKSARGEN)" }
  ],
  [PSGC_VALUE_SETS.provinces]: [
    { code: "0600400000", display: "Aklan" },
    { code: "1206300000", display: "South Cotabato" }
  ],
  [PSGC_VALUE_SETS.cities]: [
    { code: "0600407000", display: "Kalibo " },
    { code: "1206306000", display: "City of Koronadal " }
  ],
  [PSGC_VALUE_SETS.barangays]: [
    { code: "0600407013", display: "Poblacion" },
    { code: "1206306018", display: "Zone III " }
  ]
};

describe("PSGC directory", () => {
  beforeEach(() => {
    clearPsgcDirectoryCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input) => {
        const canonical = new URL(String(input)).searchParams.get("url") ?? "";
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "ValueSet",
            version: PSGC_VERSION,
            expansion: {
              contains: (expansions[canonical] ?? []).map((item) => ({
                system: PSGC_SYSTEM,
                ...item
              }))
            }
          })
        } as Response;
      })
    );
  });

  it("loads controlled PSGC value sets and trims server display whitespace", async () => {
    const directory = await loadPsgcDirectory("https://tx.example.test/fhir");
    const barangays = await loadPsgcBarangays(
      "https://tx.example.test/fhir"
    );
    expect(directory.cities[1]).toEqual(
      expect.objectContaining({
        code: "1206306000",
        display: "City of Koronadal",
        version: PSGC_VERSION
      })
    );
    expect(barangays[1].display).toBe("Zone III");
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

  it("falls back to the bundled same-origin PSGC snapshot when live expansion is blocked", async () => {
    clearPsgcDirectoryCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input) => {
        if (String(input).includes("psgc.generated.json")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              system: PSGC_SYSTEM,
              version: PSGC_VERSION,
              regions: expansions[PSGC_VALUE_SETS.regions],
              provinces: expansions[PSGC_VALUE_SETS.provinces],
              cities: expansions[PSGC_VALUE_SETS.cities],
              barangays: expansions[PSGC_VALUE_SETS.barangays]
            })
          } as Response;
        }
        throw new TypeError("Failed to fetch");
      })
    );
    const directory = await loadPsgcDirectory("https://tx.example.test/fhir");
    expect(directory.regions).toHaveLength(2);
    expect(directory.cities[1].code).toBe("1206306000");
  });
});
