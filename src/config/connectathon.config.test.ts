import { describe, expect, it } from "vitest";
import {
  CONNECTATHON_CONFIG,
  PRESET_CAPABILITIES,
  assertExternalWritesAllowed
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
});
