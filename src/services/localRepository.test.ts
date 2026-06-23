import { beforeEach, describe, expect, it } from "vitest";
import { localRepository } from "./localRepository";

describe("versioned local repository", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to Demo mode and persists sessions", () => {
    const state = localRepository.load();
    expect(state.version).toBe(2);
    expect(state.settings.demoMode).toBe(true);
    const next = localRepository.setSession(state, {
      userId: "user-kalibo",
      loggedInAt: "2026-06-23T00:00:00Z"
    });
    expect(localRepository.load().session).toEqual(next.session);
    expect(localRepository.clearSession(next).session).toBeNull();
  });

  it("migrates legacy endpoint overrides", () => {
    localStorage.setItem(
      "pheref.endpoints",
      JSON.stringify({ pherefBaseUrl: "https://example.test/fhir" })
    );
    expect(localRepository.load().settings.pherefBaseUrl).toBe("https://example.test/fhir");
  });
});
