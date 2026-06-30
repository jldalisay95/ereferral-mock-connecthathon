import type { FhirResource, ReferralAggregate } from "../types";
import { readResource, searchResources } from "./fhirClient";
import { IDENTIFIER_SYSTEMS } from "../config/fhir";

export interface RemoteReferralSearchCriteria {
  patient?: string;
  organization?: string;
  serviceStatus?: string;
  taskStatus?: string;
}

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

async function searchResourcesSafe(
  baseUrl: string,
  resourceType: string,
  params: URLSearchParams
): Promise<FhirResource[]> {
  return searchResources(baseUrl, resourceType, params).catch(() => []);
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

function uniqueResources(resources: FhirResource[]) {
  return [
    ...new Map(
      resources.map((resource) => [
        resource.id ? `${resource.resourceType}/${resource.id}` : JSON.stringify(resource),
        resource
      ])
    ).values()
  ];
}

function referenceOf(resource: FhirResource) {
  return resource.id ? `${resource.resourceType}/${resource.id}` : "";
}

function intersectServiceRequests(resultSets: FhirResource[][]) {
  if (!resultSets.length) return [];
  const [first, ...rest] = resultSets.map(uniqueResources);
  return first.filter((candidate) =>
    rest.every((set) =>
      set.some(
        (item) =>
          item.resourceType === candidate.resourceType &&
          item.id &&
          candidate.id &&
          item.id === candidate.id
      )
    )
  );
}

async function serviceRequestsForPatient(baseUrl: string, value: string) {
  const query = value.trim();
  if (!query) return [];
  const patientResults = await Promise.all([
    searchResources(baseUrl, "Patient", new URLSearchParams({ identifier: query })),
    searchResources(baseUrl, "Patient", new URLSearchParams({ name: query }))
  ]);
  const patients = uniqueResources(patientResults.flat());
  const serviceRequestBatches = await Promise.all(
    patients.flatMap((patient) => {
      const reference = referenceOf(patient);
      return reference
        ? [searchResources(baseUrl, "ServiceRequest", new URLSearchParams({ subject: reference }))]
        : [];
    })
  );
  return uniqueResources(serviceRequestBatches.flat());
}

async function serviceRequestsForOrganization(baseUrl: string, value: string) {
  const query = value.trim();
  if (!query) return [];
  const organizationResults = await Promise.all([
    searchResources(baseUrl, "Organization", new URLSearchParams({ name: query })),
    searchResources(
      baseUrl,
      "Organization",
      new URLSearchParams({ identifier: `${IDENTIFIER_SYSTEMS.nhfr}|${query}` })
    ),
    searchResources(baseUrl, "Organization", new URLSearchParams({ identifier: query }))
  ]);
  const organizations = uniqueResources(organizationResults.flat());
  const organizationRefs = organizations.map(referenceOf).filter(Boolean);
  const roleBatches = await Promise.all(
    organizationRefs.map((organizationRef) =>
      searchResources(
        baseUrl,
        "PractitionerRole",
        new URLSearchParams({ organization: organizationRef })
      )
    )
  );
  const roleRefs = uniqueResources(roleBatches.flat()).map(referenceOf).filter(Boolean);
  const batches = await Promise.all([
    ...organizationRefs.map((organizationRef) =>
      searchResources(baseUrl, "ServiceRequest", new URLSearchParams({ performer: organizationRef }))
    ),
    ...roleRefs.flatMap((roleRef) => [
      searchResources(baseUrl, "ServiceRequest", new URLSearchParams({ requester: roleRef })),
      searchResources(baseUrl, "ServiceRequest", new URLSearchParams({ performer: roleRef }))
    ])
  ]);
  return uniqueResources(batches.flat());
}

async function serviceRequestsForOrganizationRefs(
  baseUrl: string,
  organizationRefs: string[]
) {
  const roleBatches = await Promise.all(
    organizationRefs.map((organizationRef) =>
      searchResources(
        baseUrl,
        "PractitionerRole",
        new URLSearchParams({ organization: organizationRef })
      )
    )
  );
  const roleRefs = uniqueResources(roleBatches.flat()).map(referenceOf).filter(Boolean);
  const directBatches = await Promise.all([
    ...organizationRefs.map((organizationRef) =>
      searchResources(baseUrl, "ServiceRequest", new URLSearchParams({ performer: organizationRef }))
    ),
    ...roleRefs.map((roleRef) =>
      searchResources(baseUrl, "ServiceRequest", new URLSearchParams({ performer: roleRef }))
    )
  ]);
  const taskBatches = await Promise.all([
    ...organizationRefs.map((organizationRef) =>
      searchResources(baseUrl, "Task", new URLSearchParams({ owner: organizationRef }))
    ),
    ...roleRefs.map((roleRef) =>
      searchResources(baseUrl, "Task", new URLSearchParams({ owner: roleRef }))
    )
  ]);
  const taskServiceRequestBatches = await Promise.all(
    uniqueResources(taskBatches.flat()).flatMap((task) => {
      const parsed = parseReference(task.focus);
      return parsed?.resourceType === "ServiceRequest"
        ? [
            searchResources(
              baseUrl,
              "ServiceRequest",
              new URLSearchParams({ _id: parsed.id })
            )
          ]
        : [];
    })
  );
  return uniqueResources([...directBatches.flat(), ...taskServiceRequestBatches.flat()]);
}

export async function searchIncomingReferralsForFacility(
  baseUrl: string,
  facility: {
    name: string;
    nhfrCode?: string;
    fhirReference?: string;
  }
) {
  const organizationRefs = new Set<string>();
  const parsedReference = parseReference(facility.fhirReference);
  if (parsedReference?.resourceType === "Organization") {
    organizationRefs.add(`Organization/${parsedReference.id}`);
  }
  const searches: Array<Promise<FhirResource[]>> = [];
  if (facility.name.trim()) {
    searches.push(
      searchResources(
        baseUrl,
        "Organization",
        new URLSearchParams({ name: facility.name.trim(), _count: "20" })
      )
    );
  }
  if (facility.nhfrCode?.trim()) {
    searches.push(
      searchResources(
        baseUrl,
        "Organization",
        new URLSearchParams({
          identifier: `${IDENTIFIER_SYSTEMS.nhfr}|${facility.nhfrCode.trim()}`,
          _count: "20"
        })
      ),
      searchResources(
        baseUrl,
        "Organization",
        new URLSearchParams({ identifier: facility.nhfrCode.trim(), _count: "20" })
      )
    );
  }
  const settled = await Promise.allSettled(searches);
  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      uniqueResources(result.value).forEach((organization) => {
        const ref = referenceOf(organization);
        if (ref) organizationRefs.add(ref);
      });
    }
  });
  if (!organizationRefs.size) return [];
  return serviceRequestsForOrganizationRefs(baseUrl, [...organizationRefs]);
}

async function serviceRequestsForTaskStatus(baseUrl: string, status: string) {
  const value = status.trim();
  if (!value) return [];
  const tasks = await searchResources(
    baseUrl,
    "Task",
    new URLSearchParams({ status: value })
  );
  const batches = await Promise.all(
    tasks.flatMap((task) => {
      const focus = task.focus as { reference?: string } | undefined;
      const parsed = parseReference(focus);
      return parsed?.resourceType === "ServiceRequest"
        ? [
            searchResources(
              baseUrl,
              "ServiceRequest",
              new URLSearchParams({ _id: parsed.id })
            )
          ]
        : [];
    })
  );
  return uniqueResources(batches.flat());
}

export async function searchRemoteReferrals(
  baseUrl: string,
  criteria: RemoteReferralSearchCriteria
) {
  const searches: Array<Promise<FhirResource[]>> = [];
  if (criteria.patient?.trim()) {
    searches.push(serviceRequestsForPatient(baseUrl, criteria.patient));
  }
  if (criteria.organization?.trim()) {
    searches.push(serviceRequestsForOrganization(baseUrl, criteria.organization));
  }
  if (criteria.serviceStatus?.trim()) {
    searches.push(
      searchResources(
        baseUrl,
        "ServiceRequest",
        new URLSearchParams({ status: criteria.serviceStatus.trim(), _count: "50" })
      )
    );
  }
  if (criteria.taskStatus?.trim()) {
    searches.push(serviceRequestsForTaskStatus(baseUrl, criteria.taskStatus));
  }
  if (!searches.length) {
    return searchResources(
      baseUrl,
      "ServiceRequest",
      new URLSearchParams({ _count: "50" })
    );
  }
  return uniqueResources(intersectServiceRequests(await Promise.all(searches)));
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

  const referencedActors = await uniqueReferencedResources(baseUrl, [
    serviceRequest.requester,
    ...(Array.isArray(serviceRequest.performer) ? serviceRequest.performer : [])
  ]);
  const directOrganizations = referencedActors.filter(
    (resource) => resource.resourceType === "Organization"
  );
  const practitionerRoles = referencedActors.filter(
    (resource) => resource.resourceType === "PractitionerRole"
  );
  const directPractitioners = referencedActors.filter(
    (resource) => resource.resourceType === "Practitioner"
  );

  const [
    tasks,
    conditions,
    observations,
    procedures,
    diagnosticReportsByEncounter,
    diagnosticReportsByServiceRequest,
    provenances
  ] = await Promise.all([
    searchResourcesSafe(baseUrl, "Task", new URLSearchParams({ focus: serviceRequestRef })),
    encounterRef
      ? searchResourcesSafe(baseUrl, "Condition", new URLSearchParams({ encounter: encounterRef }))
      : patientRef
        ? searchResourcesSafe(baseUrl, "Condition", new URLSearchParams({ subject: patientRef }))
        : [],
    encounterRef
      ? searchResourcesSafe(baseUrl, "Observation", new URLSearchParams({ encounter: encounterRef }))
      : [],
    encounterRef
      ? searchResourcesSafe(baseUrl, "Procedure", new URLSearchParams({ encounter: encounterRef }))
      : [],
    encounterRef
      ? searchResourcesSafe(baseUrl, "DiagnosticReport", new URLSearchParams({ encounter: encounterRef }))
      : [],
    searchResourcesSafe(
      baseUrl,
      "DiagnosticReport",
      new URLSearchParams({ "based-on": serviceRequestRef })
    ),
    searchResourcesSafe(baseUrl, "Provenance", new URLSearchParams({ target: serviceRequestRef }))
  ]);
  const diagnosticReports = uniqueResources([
    ...diagnosticReportsByServiceRequest,
    ...diagnosticReportsByEncounter
  ]);

  const taskActors = await uniqueReferencedResources(baseUrl, [
    tasks[0]?.requester,
    tasks[0]?.owner
  ]);
  const allPractitionerRoles = uniqueResources([
    ...practitionerRoles,
    ...taskActors.filter((resource) => resource.resourceType === "PractitionerRole")
  ]);
  const roleOrganizations = await uniqueReferencedResources(
    baseUrl,
    allPractitionerRoles.map((role) => role.organization)
  );
  const rolePractitioners = await uniqueReferencedResources(
    baseUrl,
    allPractitionerRoles.map((role) => role.practitioner)
  );
  const organizations = uniqueResources([
    ...directOrganizations,
    ...taskActors.filter((resource) => resource.resourceType === "Organization"),
    ...roleOrganizations
  ]);
  const practitioners = uniqueResources([
    ...directPractitioners,
    ...taskActors.filter((resource) => resource.resourceType === "Practitioner"),
    ...rolePractitioners
  ]);

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
    practitionerRoles: allPractitionerRoles
  };
}
