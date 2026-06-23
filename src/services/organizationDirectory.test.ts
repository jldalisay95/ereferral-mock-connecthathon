import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ENDPOINTS, IDENTIFIER_SYSTEMS } from "../config/fhir";
import {
  organizationDestinationId,
  organizationFromFhir,
  searchOrganizationDirectory
} from "./organizationDirectory";

describe("FHIR Organization directory", () => {
  it("maps PH Core identifiers and address details", () => {
    const organization = organizationFromFhir(
      {
        resourceType: "Organization",
        id: "hospital-1",
        name: "Directory Hospital",
        identifier: [
          { system: IDENTIFIER_SYSTEMS.nhfr, value: "NHFR-123" },
          { system: IDENTIFIER_SYSTEMS.hcpn, value: "Network A" }
        ],
        telecom: [{ system: "phone", value: "555-0100" }],
        address: [{ line: ["Main Road"], city: "Kalibo", state: "Aklan" }]
      },
      DEFAULT_ENDPOINTS.phCoreBaseUrl,
      "PH Core CDR"
    );
    expect(organization).toEqual(
      expect.objectContaining({
        name: "Directory Hospital",
        nhfrCode: "NHFR-123",
        hcpnName: "Network A",
        phone: "555-0100",
        source: "fhir",
        fhirServerLabel: "PH Core CDR"
      })
    );
    expect(organizationDestinationId(organization!)).toContain(
      "Organization/hospital-1"
    );
  });

  it("searches both configured servers and de-duplicates results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "Bundle",
          entry: [
            {
              resource: {
                resourceType: "Organization",
                id: "hospital-1",
                name: "Directory Hospital"
              }
            }
          ]
        })
      })
    );
    const results = await searchOrganizationDirectory(
      DEFAULT_ENDPOINTS,
      "Directory"
    );
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.fhirServerLabel)).toEqual(
      expect.arrayContaining(["PH Core CDR", "PHeReF CDR"])
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
  });

  it("reports when neither configured Organization endpoint is reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      searchOrganizationDirectory(DEFAULT_ENDPOINTS, "Hospital")
    ).rejects.toThrow(/no configured fhir organization endpoint/i);
  });
});
