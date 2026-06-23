import { parseOperationOutcome } from "../fhir/operationOutcome";
import type {
  EndpointConfig,
  FhirResource,
  SubmissionReceipt,
  ValidationSummary
} from "../types";

export class FhirHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public resource?: FhirResource
  ) {
    super(message);
  }
}

export interface DetailedValidationResult {
  summary: ValidationSummary;
  outcome?: FhirResource;
}

async function request(
  url: string,
  init: RequestInit = {}
): Promise<{ resource: FhirResource; status: number }> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(90_000),
    headers: {
      Accept: "application/fhir+json",
      ...(init.body ? { "Content-Type": "application/fhir+json" } : {}),
      ...init.headers
    }
  });
  const resource = (await response.json().catch(() => ({
    resourceType: "OperationOutcome",
    issue: [{ severity: "error", diagnostics: "Server returned a non-JSON response." }]
  }))) as FhirResource;
  if (!response.ok) {
    throw new FhirHttpError(`FHIR request failed (${response.status})`, response.status, resource);
  }
  return { resource, status: response.status };
}

export async function getMetadata(baseUrl: string): Promise<FhirResource> {
  return (await request(`${baseUrl.replace(/\/$/, "")}/metadata`)).resource;
}

export const checkMetadata = getMetadata;

export async function validateResourceDetailed(
  baseUrl: string,
  resourceType: string,
  resource: FhirResource
): Promise<DetailedValidationResult> {
  try {
    const result = await request(
      `${baseUrl.replace(/\/$/, "")}/${resourceType}/$validate`,
      { method: "POST", body: JSON.stringify(resource) }
    );
    return {
      summary: parseOperationOutcome(result.resource, result.status),
      outcome: result.resource
    };
  } catch (error) {
    if (error instanceof FhirHttpError && error.resource) {
      return {
        summary: parseOperationOutcome(error.resource, error.status),
        outcome: error.resource
      };
    }
    throw error;
  }
}

export async function validateResource(
  baseUrl: string,
  resourceType: string,
  resource: FhirResource
): Promise<ValidationSummary> {
  return (await validateResourceDetailed(baseUrl, resourceType, resource)).summary;
}

export const validateBundle = (baseUrl: string, bundle: FhirResource) =>
  validateResource(baseUrl, "Bundle", bundle);

export const validateBundleDetailed = (baseUrl: string, bundle: FhirResource) =>
  validateResourceDetailed(baseUrl, "Bundle", bundle);

export async function submitTransactionBundle(
  baseUrl: string,
  bundle: FhirResource
): Promise<FhirResource> {
  return (
    await request(baseUrl.replace(/\/$/, ""), {
      method: "POST",
      body: JSON.stringify(bundle)
    })
  ).resource;
}

export const submitBundle = submitTransactionBundle;

export async function readResource(
  baseUrl: string,
  resourceType: string,
  id: string
): Promise<FhirResource> {
  return (await request(`${baseUrl.replace(/\/$/, "")}/${resourceType}/${id}`)).resource;
}

export async function searchResources(
  baseUrl: string,
  resourceType: string,
  params: URLSearchParams
): Promise<FhirResource[]> {
  const bundle = (
    await request(`${baseUrl.replace(/\/$/, "")}/${resourceType}?${params.toString()}`)
  ).resource;
  return Array.isArray(bundle.entry)
    ? bundle.entry.flatMap((entry) => {
        const resource = (entry as { resource?: FhirResource }).resource;
        return resource ? [resource] : [];
      })
    : [];
}

export async function updateResource(
  baseUrl: string,
  resourceType: string,
  id: string,
  resource: FhirResource
): Promise<FhirResource> {
  return (
    await request(`${baseUrl.replace(/\/$/, "")}/${resourceType}/${id}`, {
      method: "PUT",
      body: JSON.stringify(resource)
    })
  ).resource;
}

export async function putResource(
  baseUrl: string,
  resource: FhirResource
): Promise<FhirResource> {
  if (!resource.id) throw new Error("Cannot update a resource without an id.");
  return updateResource(baseUrl, resource.resourceType, resource.id, resource);
}

export async function patchResource(
  baseUrl: string,
  resourceType: string,
  id: string,
  patch: unknown
): Promise<FhirResource> {
  return (
    await request(`${baseUrl.replace(/\/$/, "")}/${resourceType}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json-patch+json" },
      body: JSON.stringify(patch)
    })
  ).resource;
}

export function parseTransactionResponse(
  response: FhirResource,
  patientName: string,
  referralId: string
): SubmissionReceipt {
  const resourceIds: Record<string, string[]> = {};
  for (const rawEntry of Array.isArray(response.entry) ? response.entry : []) {
    const entry = rawEntry as { response?: { location?: string } };
    const location = entry.response?.location;
    const match = location?.match(/^([^/]+)\/([^/]+)/);
    if (match) {
      const [, type, id] = match;
      resourceIds[type] = [...(resourceIds[type] ?? []), id];
    }
  }
  return {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    patientName,
    referralId,
    taskStatus: "requested",
    resourceIds,
    response
  };
}

export const endpointList = (config: EndpointConfig) => [
  { key: "pheref", label: "PHeRef CDR", url: config.pherefBaseUrl },
  { key: "phcore", label: "PH Core CDR", url: config.phCoreBaseUrl },
  { key: "tx", label: "Terminology server", url: config.terminologyBaseUrl }
];
