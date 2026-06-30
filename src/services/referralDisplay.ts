import { IDENTIFIER_SYSTEMS } from "../config/fhir";
import type { FhirResource, ReferralAggregate } from "../types";
import { parseReference } from "./referralRetrieval";

function referenceDisplay(value: unknown) {
  return value && typeof value === "object" && "display" in value
    ? String((value as { display?: unknown }).display ?? "")
    : "";
}

function referenceText(value: unknown) {
  const reference =
    value && typeof value === "object" && "reference" in value
      ? (value as { reference?: unknown }).reference
      : value;
  return typeof reference === "string" ? reference : "";
}

function identifierValue(resource: FhirResource | undefined) {
  const identifiers = resource?.identifier as
    | Array<{ system?: string; value?: string }>
    | undefined;
  return (
    identifiers?.find((identifier) => identifier.system === IDENTIFIER_SYSTEMS.nhfr)
      ?.value ??
    identifiers?.find((identifier) => identifier.value)?.value ??
    resource?.id ??
    ""
  );
}

export function organizationLabel(
  resource: FhirResource | undefined,
  fallback = ""
) {
  if (!resource) return fallback;
  const name = typeof resource.name === "string" ? resource.name : fallback;
  const id = identifierValue(resource);
  return [name, id].filter(Boolean).join(" - ");
}

function roleOrganizationLabel(
  aggregate: ReferralAggregate,
  role: FhirResource | undefined,
  fallback = ""
) {
  const organizationRef = role?.organization;
  const parsed = parseReference(organizationRef);
  const organization = aggregate.organizations.find(
    (candidate) => candidate.id === parsed?.id
  );
  return organizationLabel(
    organization,
    referenceDisplay(organizationRef) || referenceText(organizationRef) || fallback
  );
}

export function facilityLabelFromReference(
  aggregate: ReferralAggregate,
  reference: unknown,
  fallback = ""
) {
  const parsed = parseReference(reference);
  if (parsed?.resourceType === "Organization") {
    const organization = aggregate.organizations.find(
      (candidate) => candidate.id === parsed.id
    );
    return organizationLabel(
      organization,
      referenceDisplay(reference) || referenceText(reference) || fallback
    );
  }
  if (parsed?.resourceType === "PractitionerRole") {
    const role = aggregate.practitionerRoles.find(
      (candidate) => candidate.id === parsed.id
    );
    return roleOrganizationLabel(
      aggregate,
      role,
      referenceDisplay(reference) || referenceText(reference) || fallback
    );
  }
  return referenceDisplay(reference) || referenceText(reference) || fallback;
}

export function referralFacilityLabels(aggregate: ReferralAggregate) {
  const performerReference = Array.isArray(aggregate.serviceRequest.performer)
    ? aggregate.serviceRequest.performer[0]
    : aggregate.serviceRequest.performer;
  return {
    referring: facilityLabelFromReference(
      aggregate,
      aggregate.serviceRequest.requester,
      "Unknown referring facility"
    ),
    receiving: facilityLabelFromReference(
      aggregate,
      performerReference ?? aggregate.task?.owner,
      "Unknown receiving facility"
    ),
    taskRequester: facilityLabelFromReference(
      aggregate,
      aggregate.task?.requester ?? aggregate.serviceRequest.requester,
      "Unknown requester"
    ),
    taskOwner: facilityLabelFromReference(
      aggregate,
      aggregate.task?.owner ?? performerReference,
      "Unknown owner"
    )
  };
}
