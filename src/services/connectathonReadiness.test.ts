import { describe, expect, it } from "vitest";
import {
  CONNECTATHON_CONFIG,
  type ConnectathonConfig
} from "../config/connectathon.config";
import { checkConfiguredUrls } from "./connectathonReadiness";
import { terminologyCacheKey } from "./terminologyClient";

describe("Connectathon configuration consumers", () => {
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
});
