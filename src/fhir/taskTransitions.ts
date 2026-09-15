import type {
  CareStatus,
  CodingInput,
  FhirResource,
  ReceivingResponse,
  TaskTransition
} from "../types";

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

export function isReceivingResponseTransition(
  transition: TaskTransition
): transition is ReceivingResponse {
  return receivingResponses.includes(transition as ReceivingResponse);
}

export function taskStatusForTransition(transition: TaskTransition) {
  if (transition === "referred-onward") return "rejected";
  if (transition === "discharged" || transition === "completed") return "completed";
  if (careStatuses.includes(transition as CareStatus)) return "in-progress";
  return transition;
}

export function applyTaskTransition(
  task: FhirResource,
  transition: TaskTransition,
  note: string,
  receivingResponseCoding?: CodingInput
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
  if (isReceivingResponseTransition(transition)) {
    if (
      !receivingResponseCoding?.system ||
      receivingResponseCoding.code !== transition
    ) {
      throw new Error(
        "A matching live eReferral Receiving Facility Response coding is required."
      );
    }
    next.businessStatus = {
      coding: [{ ...receivingResponseCoding }]
    };
  }
  if (transition === "rejected") next.statusReason = { text: note.trim() };
  if (transition === "referred-onward") {
    next.statusReason = {
      text: note.trim()
    };
  }
  return next;
}
