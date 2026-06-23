import type {
  CareStatus,
  FhirResource,
  ReceivingResponse,
  TaskTransition
} from "../types";

const WORKFLOW_SYSTEM =
  "https://fhir.doh.gov.ph/pheref/CodeSystem/ereferral-workflow";

const receivingResponses: ReceivingResponse[] = [
  "received",
  "accepted",
  "rejected",
  "referred-onward"
];

const careStatuses: CareStatus[] = [
  "arrived",
  "admitted",
  "er-observation",
  "other-care",
  "discharged"
];

export function taskStatusForTransition(transition: TaskTransition) {
  if (transition === "referred-onward") return "rejected";
  if (transition === "discharged" || transition === "completed") return "completed";
  if (careStatuses.includes(transition as CareStatus)) return "in-progress";
  return transition;
}

export function applyTaskTransition(
  task: FhirResource,
  transition: TaskTransition,
  note: string
): FhirResource {
  if (!note.trim()) {
    throw new Error("Remarks are required for every workflow update.");
  }
  const next: FhirResource = {
    ...task,
    status: taskStatusForTransition(transition),
    lastModified: new Date().toISOString(),
    note: note.trim()
      ? [...(Array.isArray(task.note) ? task.note : []), { text: note.trim() }]
      : task.note
  };
  if (receivingResponses.includes(transition as ReceivingResponse)) {
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
