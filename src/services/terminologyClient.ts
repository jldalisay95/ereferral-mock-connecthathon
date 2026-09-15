import type { CodingInput } from "../types";
import { CONNECTATHON_CONFIG } from "../config/connectathon.config";

export interface ExpansionResult {
  canonical: string;
  codes: CodingInput[];
  warning?: string;
}

export function buildExpandUrl(baseUrl: string, canonical: string): string {
  return `${baseUrl.replace(/\/$/, "")}/ValueSet/$expand?url=${encodeURIComponent(canonical)}`;
}

interface ExpansionContains {
  system?: unknown;
  code?: unknown;
  display?: unknown;
  contains?: ExpansionContains[];
}

function flattenExpansion(items: ExpansionContains[]): CodingInput[] {
  return items.flatMap((item) => [
    ...(typeof item.code === "string"
      ? [{
          system: typeof item.system === "string" ? item.system : "",
          code: item.code,
          display: typeof item.display === "string" ? item.display : item.code
        }]
      : []),
    ...flattenExpansion(item.contains ?? [])
  ]);
}

export function terminologyCacheKey(baseUrl: string, canonical: string): string {
  const { preset, ig, psgc } = CONNECTATHON_CONFIG;
  return [
    "pheref.tx",
    preset,
    ig.version,
    psgc.version,
    encodeURIComponent(baseUrl.replace(/\/$/, "")),
    encodeURIComponent(canonical)
  ].join(".");
}

export async function expandValueSet(
  baseUrl: string,
  canonical: string,
  signal?: AbortSignal,
  useCache = true
): Promise<ExpansionResult> {
  const cacheKey = terminologyCacheKey(baseUrl, canonical);
  const cached = useCache ? sessionStorage.getItem(cacheKey) : null;
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
  const expansion = body?.expansion as { contains?: ExpansionContains[] } | undefined;
  const codes = flattenExpansion(expansion?.contains ?? []);
  if (!codes.length) {
    throw new Error(`Terminology expansion returned no codes for ${canonical}.`);
  }
  const result: ExpansionResult = {
    canonical,
    codes
  };
  if (useCache) sessionStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
}
