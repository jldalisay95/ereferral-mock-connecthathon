import type { FhirResource, TaskTransition } from "../types";

const WORKFLOW_SYSTEM = "https://fhir.doh.gov.ph/pheref/CodeSystem/ereferral-workflow";

export function applyTaskTransition(
  task: FhirResource,
  transition: TaskTransition,
  note: string
): FhirResource {
  if ((transition === "rejected" || transition === "referred-onward") && !note.trim()) {
    throw new Error("A reason is required for rejection or onward referral.");
  }
  const status = transition === "referred-onward" ? "rejected" : transition;
  const next: FhirResource = {
    ...task,
    status,
    lastModified: new Date().toISOString(),
    note: note.trim()
      ? [...(Array.isArray(task.note) ? task.note : []), { text: note.trim() }]
      : task.note
  };
  if (transition !== "completed") {
    next.businessStatus = {
      coding: [
        {
          system: WORKFLOW_SYSTEM,
          code: transition,
          display:
            transition === "referred-onward"
              ? "Referred onward"
              : transition[0].toUpperCase() + transition.slice(1)
        }
      ]
    };
  }
  if (transition === "rejected") next.statusReason = { text: note.trim() };
  if (transition === "referred-onward") {
    next.statusReason = {
      coding: [
        {
          system: WORKFLOW_SYSTEM,
          code: "capacity-full",
          display: "Capacity full"
        }
      ],
      text: note.trim()
    };
  }
  return next;
}
