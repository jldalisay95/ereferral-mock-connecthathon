import { describe, expect, it } from "vitest";
import { applyTaskTransition } from "./taskTransitions";

const task = {
  resourceType: "Task",
  id: "1",
  status: "requested",
  intent: "order",
  focus: { reference: "ServiceRequest/1" },
  requester: { reference: "PractitionerRole/1" }
};

describe("Task transitions", () => {
  it.each([
    ["received", "received", "received"],
    ["accepted", "accepted", "accepted"],
    ["rejected", "rejected", "rejected"],
    ["referred-onward", "rejected", "referred-onward"]
  ] as const)("maps %s to FHIR status %s and business status %s", (transition, status, businessCode) => {
    const updated = applyTaskTransition(task, transition, "Synthetic reason");
    expect(updated.status).toBe(status);
    expect(
      (updated.businessStatus as { coding: Array<{ code: string }> }).coding[0].code
    ).toBe(businessCode);
  });

  it("preserves businessStatus when completed", () => {
    const accepted = applyTaskTransition(task, "accepted", "Accepted");
    const completed = applyTaskTransition(accepted, "completed", "Completed");
    expect(completed.status).toBe("completed");
    expect(completed.businessStatus).toEqual(accepted.businessStatus);
  });

  it("requires a reason for rejection and onward referral", () => {
    expect(() => applyTaskTransition(task, "rejected", "")).toThrow(/reason is required/i);
    expect(() => applyTaskTransition(task, "referred-onward", " ")).toThrow(/reason is required/i);
  });
});
