import { describe, expect, it } from "vitest";
import {
  CONNECTATHON_CONFIG,
  PRESET_CAPABILITIES,
  assertExternalWritesAllowed,
  resolveValueSetEndpoint
} from "./connectathon.config";

describe("Connectathon presets", () => {
  it("keeps the participant preset validation-capable and write-locked", () => {
    expect(PRESET_CAPABILITIES.participant).toMatchObject({
      remoteReads: true,
      validation: true,
      externalWrites: false
    });
    expect(() =>
      assertExternalWritesAllowed({
        preset: "participant",
        capabilities: PRESET_CAPABILITIES.participant
      })
    ).toThrow(/participant preset/i);
  });

  it("permits writes only for the ready capability definition", () => {
    expect(() =>
      assertExternalWritesAllowed({
        preset: "ready",
        capabilities: PRESET_CAPABILITIES.ready
      })
    ).not.toThrow();
  });

  it("uses the test mode as the ready preset for existing end-to-end workflows", () => {
    expect(CONNECTATHON_CONFIG.preset).toBe("ready");
  });

  it("routes each ValueSet to its configured expansion server", () => {
    const administrativeGender = CONNECTATHON_CONFIG.terminology.valueSets.find(
      (valueSet) => valueSet.key === "administrative-gender"
    );
    const referralCategory = CONNECTATHON_CONFIG.terminology.valueSets.find(
      (valueSet) => valueSet.key === "referral-category"
    );

    expect(administrativeGender?.endpoint).toBe("pherefBaseUrl");
    expect(resolveValueSetEndpoint(administrativeGender!, CONNECTATHON_CONFIG.endpoints)).toBe(
      CONNECTATHON_CONFIG.endpoints.pherefBaseUrl
    );
    expect(referralCategory?.endpoint).toBe("terminologyBaseUrl");
    expect(resolveValueSetEndpoint(referralCategory!, CONNECTATHON_CONFIG.endpoints)).toBe(
      CONNECTATHON_CONFIG.endpoints.terminologyBaseUrl
    );
  });

  it("configures PWD disability as a ValueSet rather than a StructureDefinition", () => {
    const pwdDisability = CONNECTATHON_CONFIG.terminology.valueSets.find(
      (valueSet) => valueSet.key === "pwd-disability"
    );

    expect(pwdDisability?.canonical).toContain("/ValueSet/");
    expect(pwdDisability?.canonical).not.toContain("/StructureDefinition/");
  });
});
