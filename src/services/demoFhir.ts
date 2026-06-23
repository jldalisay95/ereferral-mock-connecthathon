import type { FhirResource } from "../types";

interface ResolvedTransaction {
  response: FhirResource;
  resources: FhirResource[];
  resourceIds: Record<string, string[]>;
}

function rewriteReferences(value: unknown, referenceMap: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteReferences(item, referenceMap));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] =
      key === "reference" && typeof child === "string" && referenceMap.has(child)
        ? referenceMap.get(child)
        : rewriteReferences(child, referenceMap);
  }
  return result;
}

export function resolveTransactionBundle(
  bundle: FhirResource,
  transactionResponse?: FhirResource
): ResolvedTransaction {
  const entries = Array.isArray(bundle.entry)
    ? (bundle.entry as Array<{
        fullUrl?: string;
        resource?: FhirResource;
      }>)
    : [];
  const responseEntries = Array.isArray(transactionResponse?.entry)
    ? (transactionResponse.entry as Array<{ response?: { location?: string; status?: string } }>)
    : [];
  const referenceMap = new Map<string, string>();
  const resourceIds: Record<string, string[]> = {};

  entries.forEach((entry, index) => {
    if (!entry.resource || !entry.fullUrl) return;
    const location = responseEntries[index]?.response?.location;
    const parsed = location?.match(/^([^/]+)\/([^/]+)/);
    const resourceType = parsed?.[1] ?? entry.resource.resourceType;
    const id = parsed?.[2] ?? `local-${crypto.randomUUID()}`;
    const relativeReference = `${resourceType}/${id}`;
    referenceMap.set(entry.fullUrl, relativeReference);
    resourceIds[resourceType] = [...(resourceIds[resourceType] ?? []), id];
  });

  const resources = entries.flatMap((entry) => {
    if (!entry.resource || !entry.fullUrl) return [];
    const relativeReference = referenceMap.get(entry.fullUrl);
    if (!relativeReference) return [];
    const [, id] = relativeReference.split("/");
    return [
      {
        ...(rewriteReferences(entry.resource, referenceMap) as FhirResource),
        id
      }
    ];
  });

  const response =
    transactionResponse ??
    ({
      resourceType: "Bundle",
      type: "transaction-response",
      entry: entries.map((entry) => {
        const location = entry.fullUrl ? referenceMap.get(entry.fullUrl) : undefined;
        return {
          response: {
            status: "201 Created",
            location: location ? `${location}/_history/1` : undefined
          }
        };
      })
    } satisfies FhirResource);

  return { response, resources, resourceIds };
}

export function findResource(
  resources: FhirResource[],
  resourceType: string
): FhirResource | undefined {
  return resources.find((resource) => resource.resourceType === resourceType);
}
