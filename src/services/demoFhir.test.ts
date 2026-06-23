import { describe, expect, it } from "vitest";
import { createDemoDraft } from "../data/demo";
import { buildReferralTransactionBundle } from "../fhir/builders";
import { findResource, resolveTransactionBundle } from "./demoFhir";

describe("Demo-mode FHIR transaction resolution", () => {
  it("creates local IDs, transaction-response locations, and relative references", () => {
    const bundle = buildReferralTransactionBundle(createDemoDraft());
    const resolved = resolveTransactionBundle(bundle);
    expect(resolved.response.resourceType).toBe("Bundle");
    expect(resolved.resources).toHaveLength(21);
    expect(resolved.resourceIds.Task).toHaveLength(1);
    const task = findResource(resolved.resources, "Task");
    expect(task?.id).toMatch(/^local-/);
    expect(JSON.stringify(task)).not.toContain("urn:uuid:");
    expect(JSON.stringify(task)).toContain("ServiceRequest/");
  });
});
