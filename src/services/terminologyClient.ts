import type { CodingInput } from "../types";

interface ExpansionResult {
  canonical: string;
  codes: CodingInput[];
  warning?: string;
}

export function buildExpandUrl(baseUrl: string, canonical: string): string {
  return `${baseUrl.replace(/\/$/, "")}/ValueSet/$expand?url=${encodeURIComponent(canonical)}`;
}

export async function expandValueSet(
  baseUrl: string,
  canonical: string,
  signal?: AbortSignal
): Promise<ExpansionResult> {
  const cacheKey = `pheref.tx.${canonical}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as ExpansionResult;

  const response = await fetch(buildExpandUrl(baseUrl, canonical), {
    headers: { Accept: "application/fhir+json" },
    signal: signal ?? AbortSignal.timeout(30_000)
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(
      `Terminology expansion failed (${response.status})${
        body?.resourceType === "OperationOutcome" ? " with OperationOutcome" : ""
      }`
    );
  }
  const expansion = body?.expansion as { contains?: Array<Record<string, unknown>> } | undefined;
  const result: ExpansionResult = {
    canonical,
    codes: (expansion?.contains ?? []).flatMap((item) =>
      typeof item.code === "string"
        ? [
            {
              system: typeof item.system === "string" ? item.system : "",
              code: item.code,
              display: typeof item.display === "string" ? item.display : item.code
            }
          ]
        : []
    )
  };
  sessionStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
}
