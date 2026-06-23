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
  ] as const)(
    "maps %s to FHIR status %s and business status %s",
    (transition, status, businessCode) => {
      const updated = applyTaskTransition(task, transition, "Synthetic remarks");
      expect(updated.status).toBe(status);
      expect(
        (updated.businessStatus as { coding: Array<{ code: string }> }).coding[0]
          .code
      ).toBe(businessCode);
    }
  );

  it.each([
    ["arrived", "in-progress"],
    ["admitted", "in-progress"],
    ["er-observation", "in-progress"],
    ["other-care", "in-progress"],
    ["discharged", "completed"]
  ] as const)("maps local care state %s to Task.status %s", (transition, status) => {
    const accepted = applyTaskTransition(task, "accepted", "Accepted");
    const updated = applyTaskTransition(accepted, transition, "Care update");
    expect(updated.status).toBe(status);
    expect(updated.businessStatus).toEqual(accepted.businessStatus);
  });

  it("preserves businessStatus when completed", () => {
    const accepted = applyTaskTransition(task, "accepted", "Accepted");
    const completed = applyTaskTransition(accepted, "completed", "Completed");
    expect(completed.status).toBe("completed");
    expect(completed.businessStatus).toEqual(accepted.businessStatus);
  });

  it("requires remarks for every workflow update", () => {
    expect(() => applyTaskTransition(task, "received", "")).toThrow(
      /remarks are required/i
    );
  });
});
