import {
  resolveValueSetEndpoint,
  type ConnectathonConfig
} from "../config/connectathon.config";
import type { EndpointConfig, FhirResource } from "../types";
import { getMetadata, searchResources } from "./fhirClient";
import { buildExpandUrl, expandValueSet } from "./terminologyClient";

export type ReadinessStatus = "pass" | "warning" | "fail";

export interface ReadinessResult {
  id: string;
  label: string;
  status: ReadinessStatus;
  configKey: string;
  detail: string;
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function checkConfiguredUrls(
  config: ConnectathonConfig,
  endpoints: EndpointConfig
): ReadinessResult {
  const values = [
    ["endpoints.pherefBaseUrl", endpoints.pherefBaseUrl],
    ["endpoints.phCoreBaseUrl", endpoints.phCoreBaseUrl],
    ["endpoints.terminologyBaseUrl", endpoints.terminologyBaseUrl],
    ...Object.entries(config.profiles).map(([key, value]) => [`profiles.${key}`, value]),
    ...Object.entries(config.extensions).map(([key, value]) => [`extensions.${key}`, value]),
    ...Object.entries(config.identifierSystems).map(([key, value]) => [
      `identifierSystems.${key}`,
      value
    ]),
    ...Object.entries(config.psgc.valueSets).map(([key, value]) => [
      `psgc.valueSets.${key}`,
      value
    ]),
    ...config.terminology.valueSets.map((valueSet) => [
      `terminology.valueSets.${valueSet.key}.canonical`,
      valueSet.canonical
    ])
  ];
  const invalid = values.filter(([, value]) => !isWebUrl(value));
  return {
    id: "url-syntax",
    label: "Endpoint and canonical URL syntax",
    status: invalid.length ? "fail" : "pass",
    configKey: invalid.map(([key]) => key).join(", ") || "endpoints.*, profiles.*, terminology.*",
    detail: invalid.length
      ? `Invalid HTTP(S) URL: ${invalid.map(([key]) => key).join(", ")}`
      : `${values.length} configured URLs use valid HTTP(S) syntax.`
  };
}

function capabilityVersion(resource: FhirResource): string | undefined {
  return typeof resource.fhirVersion === "string" ? resource.fhirVersion : undefined;
}

async function metadataCheck(
  id: string,
  label: string,
  configKey: string,
  baseUrl: string,
  expectedVersion: string
): Promise<ReadinessResult> {
  try {
    const metadata = await getMetadata(baseUrl);
    const version = capabilityVersion(metadata);
    const compatible = version === expectedVersion;
    return {
      id,
      label,
      status: compatible ? "pass" : "fail",
      configKey,
      detail: compatible
        ? `CapabilityStatement reports FHIR ${version}.`
        : `Expected FHIR ${expectedVersion}; server reported ${version ?? "no fhirVersion"}.`
    };
  } catch (error) {
    return {
      id,
      label,
      status: "fail",
      configKey,
      detail: error instanceof Error ? error.message : "CapabilityStatement request failed."
    };
  }
}

async function profilesCheck(
  config: ConnectathonConfig,
  endpoints: EndpointConfig
): Promise<ReadinessResult> {
  const results = await Promise.all(
    Object.entries(config.profiles).map(async ([key, canonical]) => {
      const baseUrl = canonical.includes("/phcore/")
        ? endpoints.phCoreBaseUrl
        : endpoints.pherefBaseUrl;
      try {
        const matches = await searchResources(
          baseUrl,
          "StructureDefinition",
          new URLSearchParams({ url: canonical })
        );
        return matches.length ? null : `profiles.${key} (not found)`;
      } catch (error) {
        return `profiles.${key} (${error instanceof Error ? error.message : "request failed"})`;
      }
    })
  );
  const failures = results.filter((value): value is string => Boolean(value));
  return {
    id: "profiles",
    label: "Required StructureDefinitions",
    status: failures.length ? "fail" : "pass",
    configKey: failures.join(", ") || "profiles.*",
    detail: failures.length
      ? `Unavailable: ${failures.join("; ")}`
      : `${Object.keys(config.profiles).length} required profiles are available.`
  };
}

async function terminologyCheck(
  config: ConnectathonConfig,
  endpoints: EndpointConfig
): Promise<ReadinessResult> {
  const results = await Promise.all(
    config.terminology.valueSets.map(async (valueSet) => {
      try {
        const expansion = await expandValueSet(
          resolveValueSetEndpoint(valueSet, endpoints),
          valueSet.canonical,
          undefined,
          false
        );
        return expansion.codes.length ? null : `${valueSet.key} (empty expansion)`;
      } catch (error) {
        return `${valueSet.key} via ${valueSet.endpoint} (${error instanceof Error ? error.message : "request failed"})`;
      }
    })
  );
  const failures = results.filter((value): value is string => Boolean(value));
  return {
    id: "terminology",
    label: "Live ValueSet expansion",
    status: failures.length ? "fail" : "pass",
    configKey: failures.length ? "terminology.valueSets" : "terminology.valueSets.*",
    detail: failures.length
      ? `Live expansion is required. Failures: ${failures.join("; ")}`
      : `${config.terminology.valueSets.length} ValueSets expanded live.`
  };
}

export async function checkPsgcCompatibility(
  config: ConnectathonConfig,
  endpoints: EndpointConfig
): Promise<ReadinessResult> {
  try {
    const response = await fetch(
      buildExpandUrl(endpoints.terminologyBaseUrl, config.psgc.valueSets.all),
      {
        headers: { Accept: "application/fhir+json" },
        signal: AbortSignal.timeout(90_000)
      }
    );
    const body = (await response.json().catch(() => null)) as {
      expansion?: { contains?: Array<{ code?: string; version?: string }> };
    } | null;
    if (!response.ok) throw new Error(`PSGC expansion failed (${response.status}).`);
    const entries = body?.expansion?.contains ?? [];
    const explicitVersions = new Set(
      entries.flatMap((entry) => (entry.version ? [entry.version] : []))
    );
    const mismatched = [...explicitVersions].filter(
      (version) => version !== config.psgc.version
    );
    let metadataConfirmation: FhirResource | undefined;
    let metadataError = "";
    if (entries.length && !explicitVersions.size) {
      try {
        const codeSystems = await searchResources(
          endpoints.terminologyBaseUrl,
          "CodeSystem",
          new URLSearchParams({
            url: config.codeSystems.psgc,
            version: config.psgc.version
          })
        );
        metadataConfirmation = codeSystems.find(
          (resource) =>
            resource.url === config.codeSystems.psgc &&
            resource.version === config.psgc.version
        );
      } catch (error) {
        metadataError = error instanceof Error ? error.message : "CodeSystem lookup failed.";
      }
    }
    const status: ReadinessStatus =
      !entries.length || mismatched.length
        ? "fail"
        : explicitVersions.size || metadataConfirmation
          ? "pass"
          : "warning";
    return {
      id: "psgc",
      label: "PSGC compatibility",
      status,
      configKey: "psgc.version, psgc.valueSets.all, codeSystems.psgc",
      detail: !entries.length
        ? "The live PSGC expansion returned no codes."
        : mismatched.length
          ? `Configured ${config.psgc.version}; expansion reports ${mismatched.join(", ")}.`
          : explicitVersions.size
            ? `${entries.length} codes explicitly report PSGC ${config.psgc.version}.`
            : metadataConfirmation
              ? `${entries.length} live codes returned; CodeSystem metadata confirms ${config.codeSystems.psgc}|${config.psgc.version}.`
              : `${entries.length} live codes returned, but the server omitted entry-level versions and the CodeSystem version could not be confirmed${metadataError ? `: ${metadataError}` : "."}`
    };
  } catch (error) {
    return {
      id: "psgc",
      label: "PSGC compatibility",
      status: "fail",
      configKey: "psgc.version, psgc.valueSets.all, codeSystems.psgc",
      detail: error instanceof Error ? error.message : "PSGC expansion failed."
    };
  }
}

export async function runRemoteReadinessChecks(
  config: ConnectathonConfig,
  endpoints: EndpointConfig
): Promise<ReadinessResult[]> {
  const [pheref, phCore, terminology, profiles, valueSets, psgc] = await Promise.all([
    metadataCheck("pheref-metadata", "PHeRef CapabilityStatement", "endpoints.pherefBaseUrl, ig.fhirVersion", endpoints.pherefBaseUrl, config.ig.fhirVersion),
    metadataCheck("phcore-metadata", "PH Core CapabilityStatement", "endpoints.phCoreBaseUrl, ig.fhirVersion", endpoints.phCoreBaseUrl, config.ig.fhirVersion),
    metadataCheck("tx-metadata", "Terminology CapabilityStatement", "endpoints.terminologyBaseUrl, ig.fhirVersion", endpoints.terminologyBaseUrl, config.ig.fhirVersion),
    profilesCheck(config, endpoints),
    terminologyCheck(config, endpoints),
    checkPsgcCompatibility(config, endpoints)
  ]);
  return [checkConfiguredUrls(config, endpoints), pheref, phCore, terminology, profiles, valueSets, psgc];
}
