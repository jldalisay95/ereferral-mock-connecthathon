import { describe, expect, it } from "vitest";
import {
  applyTaskTransition,
  isReceivingResponseTransition
} from "./taskTransitions";

const task = {
  resourceType: "Task",
  id: "1",
  status: "requested",
  intent: "order",
  focus: { reference: "ServiceRequest/1" },
  requester: { reference: "PractitionerRole/1" }
};

const liveResponse = (code: string) => ({
  system: "https://tx.example.test/CodeSystem/live-response",
  code,
  display: `Live ${code}`
});

describe("Task transitions", () => {
  it.each([
    ["received", "received", "received"],
    ["accepted", "accepted", "accepted"],
    ["rejected", "rejected", "rejected"],
    ["referred-onward", "rejected", "referred-onward"]
  ] as const)(
    "maps %s to FHIR status %s and business status %s",
    (transition, status, businessCode) => {
      const updated = applyTaskTransition(
        task,
        transition,
        "Synthetic remarks",
        liveResponse(transition)
      );
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
    const accepted = applyTaskTransition(
      task,
      "accepted",
      "Accepted",
      liveResponse("accepted")
    );
    const updated = applyTaskTransition(accepted, transition, "Care update");
    expect(updated.status).toBe(status);
    expect(updated.businessStatus).toEqual(accepted.businessStatus);
  });

  it("preserves businessStatus when completed", () => {
    const accepted = applyTaskTransition(
      task,
      "accepted",
      "Accepted",
      liveResponse("accepted")
    );
    const completed = applyTaskTransition(accepted, "completed", "Completed");
    expect(completed.status).toBe("completed");
    expect(completed.businessStatus).toEqual(accepted.businessStatus);
  });

  it("distinguishes official receiving responses from local care states", () => {
    expect(isReceivingResponseTransition("received")).toBe(true);
    expect(isReceivingResponseTransition("referred-onward")).toBe(true);
    expect(isReceivingResponseTransition("er-observation")).toBe(false);
    expect(isReceivingResponseTransition("other-care")).toBe(false);
  });

  it("preserves receiving response coding supplied by live terminology", () => {
    const coding = {
      system: "https://tx.example.test/CodeSystem/live-response",
      code: "accepted",
      display: "Server-supplied acceptance label"
    };
    const updated = applyTaskTransition(task, "accepted", "Accepted", coding);
    expect(updated.businessStatus).toEqual({ coding: [coding] });
  });

  it("rejects a receiving response without a live terminology coding", () => {
    expect(() => applyTaskTransition(task, "accepted", "Accepted")).toThrow(
      /matching live/i
    );
  });

  it("requires remarks for every workflow update", () => {
    expect(() => applyTaskTransition(task, "received", "")).toThrow(
      /remarks are required/i
    );
  });
});
