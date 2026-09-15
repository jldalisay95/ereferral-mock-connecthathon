import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("FHIR participant service boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_CONNECTATHON_PRESET", "participant");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects transaction POST, PUT, and PATCH before issuing a request", async () => {
    const { patchResource, submitTransactionBundle, updateResource } = await import(
      "./fhirClient"
    );
    const resource = { resourceType: "Task", id: "task-1", status: "requested" };

    await expect(
      submitTransactionBundle("https://example.test/fhir", {
        resourceType: "Bundle",
        type: "transaction"
      })
    ).rejects.toThrow(/participant preset/i);
    await expect(
      updateResource("https://example.test/fhir", "Task", "task-1", resource)
    ).rejects.toThrow(/participant preset/i);
    await expect(
      patchResource("https://example.test/fhir", "Task", "task-1", [])
    ).rejects.toThrow(/participant preset/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still permits metadata reads and non-mutating $validate", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ resourceType: "OperationOutcome", issue: [] })
    } as Response);
    const { getMetadata, validateBundleDetailed } = await import("./fhirClient");

    await getMetadata("https://example.test/fhir");
    await validateBundleDetailed("https://example.test/fhir", {
      resourceType: "Bundle",
      type: "transaction"
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://example.test/fhir/metadata",
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://example.test/fhir/Bundle/$validate",
      expect.objectContaining({ method: "POST" })
    );
  });
});
