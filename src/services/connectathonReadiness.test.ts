import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONNECTATHON_CONFIG,
  type ConnectathonConfig
} from "../config/connectathon.config";
import {
  checkConfiguredUrls,
  checkPsgcCompatibility
} from "./connectathonReadiness";
import { terminologyCacheKey } from "./terminologyClient";

describe("Connectathon configuration consumers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports the exact invalid configuration key", () => {
    const config: ConnectathonConfig = {
      ...CONNECTATHON_CONFIG,
      profiles: { ...CONNECTATHON_CONFIG.profiles, patient: "not-a-url" }
    };
    const result = checkConfiguredUrls(config, CONNECTATHON_CONFIG.endpoints);

    expect(result.status).toBe("fail");
    expect(result.configKey).toContain("profiles.patient");
    expect(result.detail).toContain("profiles.patient");
  });

  it("isolates terminology cache entries by endpoint, canonical, version, and preset", () => {
    const first = terminologyCacheKey(
      "https://tx-a.example/fhir",
      "https://example.test/ValueSet/a"
    );
    const endpointChange = terminologyCacheKey(
      "https://tx-b.example/fhir",
      "https://example.test/ValueSet/a"
    );
    const canonicalChange = terminologyCacheKey(
      "https://tx-a.example/fhir",
      "https://example.test/ValueSet/b"
    );

    expect(first).not.toBe(endpointChange);
    expect(first).not.toBe(canonicalChange);
    expect(first).toContain(CONNECTATHON_CONFIG.preset);
    expect(first).toContain(CONNECTATHON_CONFIG.ig.version);
    expect(first).toContain(CONNECTATHON_CONFIG.psgc.version);
  });

  it("confirms PSGC through CodeSystem metadata when expansion entries omit versions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/ValueSet/$expand")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              resourceType: "ValueSet",
              expansion: {
                contains: [
                  {
                    system: CONNECTATHON_CONFIG.codeSystems.psgc,
                    code: "0100000000",
                    display: "Region I (Ilocos Region)"
                  }
                ]
              }
            })
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "Bundle",
            entry: [
              {
                resource: {
                  resourceType: "CodeSystem",
                  url: CONNECTATHON_CONFIG.codeSystems.psgc,
                  version: CONNECTATHON_CONFIG.psgc.version,
                  content: "complete"
                }
              }
            ]
          })
        } as Response;
      })
    );

    const result = await checkPsgcCompatibility(
      CONNECTATHON_CONFIG,
      CONNECTATHON_CONFIG.endpoints
    );

    expect(result.status).toBe("pass");
    expect(result.detail).toContain("CodeSystem metadata confirms");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `CodeSystem?url=${encodeURIComponent(CONNECTATHON_CONFIG.codeSystems.psgc)}`
      ),
      expect.any(Object)
    );
  });
});
