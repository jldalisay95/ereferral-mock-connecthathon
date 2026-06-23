import type { FhirResource, ReferralAggregate } from "../types";
import { readResource, searchResources } from "./fhirClient";

export function parseReference(value: unknown): { resourceType: string; id: string } | null {
  const reference =
    value && typeof value === "object" && "reference" in value
      ? (value as { reference?: unknown }).reference
      : value;
  if (typeof reference !== "string") return null;
  const match = reference.match(/(?:^|\/)([A-Z][A-Za-z]+)\/([^/]+)$/);
  return match ? { resourceType: match[1], id: match[2] } : null;
}

async function readReference(baseUrl: string, value: unknown): Promise<FhirResource | undefined> {
  const parsed = parseReference(value);
  if (!parsed) return undefined;
  try {
    return await readResource(baseUrl, parsed.resourceType, parsed.id);
  } catch {
    return undefined;
  }
}

async function uniqueReferencedResources(
  baseUrl: string,
  values: unknown[]
): Promise<FhirResource[]> {
  const references = values
    .map(parseReference)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const unique = [
    ...new Map(references.map((value) => [`${value.resourceType}/${value.id}`, value])).values()
  ];
  return (
    await Promise.all(
      unique.map((value) =>
        readResource(baseUrl, value.resourceType, value.id).catch(() => undefined)
      )
    )
  ).filter((value): value is FhirResource => Boolean(value));
}

export async function hydrateReferral(
  baseUrl: string,
  serviceRequest: FhirResource
): Promise<ReferralAggregate> {
  const patient = await readReference(baseUrl, serviceRequest.subject);
  const encounter = await readReference(baseUrl, serviceRequest.encounter);
  const serviceRequestRef = `ServiceRequest/${serviceRequest.id}`;
  const patientRef = patient?.id ? `Patient/${patient.id}` : "";
  const encounterRef = encounter?.id ? `Encounter/${encounter.id}` : "";

  const [
    tasks,
    conditions,
    observations,
    procedures,
    diagnosticReports,
    provenances,
    practitionerRoles
  ] = await Promise.all([
    searchResources(baseUrl, "Task", new URLSearchParams({ focus: serviceRequestRef })),
    encounterRef
      ? searchResources(baseUrl, "Condition", new URLSearchParams({ encounter: encounterRef }))
      : patientRef
        ? searchResources(baseUrl, "Condition", new URLSearchParams({ subject: patientRef }))
        : [],
    encounterRef
      ? searchResources(baseUrl, "Observation", new URLSearchParams({ encounter: encounterRef }))
      : [],
    encounterRef
      ? searchResources(baseUrl, "Procedure", new URLSearchParams({ encounter: encounterRef }))
      : [],
    encounterRef
      ? searchResources(baseUrl, "DiagnosticReport", new URLSearchParams({ encounter: encounterRef }))
      : [],
    searchResources(baseUrl, "Provenance", new URLSearchParams({ target: serviceRequestRef })),
    uniqueReferencedResources(baseUrl, [
      serviceRequest.requester,
      ...(Array.isArray(serviceRequest.performer) ? serviceRequest.performer : [])
    ])
  ]);

  const organizations = await uniqueReferencedResources(
    baseUrl,
    practitionerRoles.map((role) => role.organization)
  );
  const practitioners = await uniqueReferencedResources(
    baseUrl,
    practitionerRoles.map((role) => role.practitioner)
  );

  return {
    serviceRequest,
    patient,
    task: tasks[0],
    encounter,
    conditions,
    observations,
    procedures,
    diagnosticReports,
    provenances,
    organizations,
    practitioners,
    practitionerRoles
  };
}
