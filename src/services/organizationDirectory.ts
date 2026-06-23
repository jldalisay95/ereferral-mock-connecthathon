import {
  IDENTIFIER_SYSTEMS,
  PSGC_VERSION
} from "../config/fhir";
import { EMPTY_ADDRESS } from "../data/patients";
import { searchResources } from "./fhirClient";
import type { AddressInput, EndpointConfig, FhirResource, OrganizationInput } from "../types";

interface FhirIdentifier {
  system?: string;
  value?: string;
}

interface FhirAddress {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  extension?: Array<{
    url?: string;
    valueCoding?: { code?: string; display?: string; version?: string };
  }>;
}

interface FhirTelecom {
  system?: string;
  value?: string;
}

function identifierValue(
  identifiers: FhirIdentifier[],
  systems: readonly string[]
) {
  return (
    identifiers.find(
      (identifier) =>
        identifier.value && systems.includes(String(identifier.system))
    )?.value ?? ""
  );
}

function addressFromResource(resource: FhirResource): AddressInput {
  const source = (resource.address as FhirAddress[] | undefined)?.[0];
  if (!source) return { ...EMPTY_ADDRESS };
  const extensionCode = (suffix: string) =>
    source.extension?.find((extension) => extension.url?.endsWith(`/${suffix}`))
      ?.valueCoding?.code ?? "";
  const extensionDisplay = (suffix: string) =>
    source.extension?.find((extension) => extension.url?.endsWith(`/${suffix}`))
      ?.valueCoding?.display?.trim() ?? "";
  const psgcVersion =
    source.extension?.find((extension) => extension.valueCoding?.version)
      ?.valueCoding?.version ?? PSGC_VERSION;
  return {
    ...EMPTY_ADDRESS,
    line: source.line?.join(", ") ?? "",
    barangay: extensionDisplay("barangay"),
    city: source.city ?? extensionDisplay("city-municipality"),
    province: source.state ?? extensionDisplay("province"),
    region: extensionDisplay("region"),
    postalCode: source.postalCode ?? "",
    barangayCode: extensionCode("barangay"),
    cityCode: extensionCode("city-municipality"),
    provinceCode: extensionCode("province"),
    regionCode: extensionCode("region"),
    psgcVersion
  };
}

export function organizationFromFhir(
  resource: FhirResource,
  baseUrl: string,
  serverLabel: string
): OrganizationInput | null {
  if (resource.resourceType !== "Organization" || !resource.id || !resource.name) {
    return null;
  }
  const identifiers = (resource.identifier as FhirIdentifier[] | undefined) ?? [];
  const telecom = (resource.telecom as FhirTelecom[] | undefined) ?? [];
  return {
    name: String(resource.name),
    nhfrCode: identifierValue(identifiers, [
      IDENTIFIER_SYSTEMS.nhfr,
      "http://nhfr.doh.gov.ph",
      "https://doh.gov.ph/fhir/healthcare-facility-code"
    ]),
    hcpnName: identifierValue(identifiers, [IDENTIFIER_SYSTEMS.hcpn]),
    phone:
      telecom.find((contact) => contact.system === "phone" && contact.value)
        ?.value ?? "",
    address: addressFromResource(resource),
    source: "fhir",
    fhirReference: `${baseUrl.replace(/\/$/, "")}/Organization/${resource.id}`,
    fhirServerLabel: serverLabel
  };
}

export function organizationDestinationId(organization: OrganizationInput) {
  return organization.fhirReference
    ? `fhir:${organization.fhirReference}`
    : `nhfr:${organization.nhfrCode}`;
}

export async function searchOrganizationDirectory(
  endpoints: EndpointConfig,
  query: string
): Promise<OrganizationInput[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  const servers = [
    { baseUrl: endpoints.pherefBaseUrl, label: "PHeReF CDR" },
    { baseUrl: endpoints.phCoreBaseUrl, label: "PH Core CDR" }
  ];
  const searches = servers.flatMap((server) => {
    const nameParams = new URLSearchParams({ name: value, _count: "20" });
    const identifierParams = new URLSearchParams({
      identifier: value,
      _count: "20"
    });
    return [
      searchResources(server.baseUrl, "Organization", nameParams).then(
        (resources) => ({ ...server, resources })
      ),
      searchResources(server.baseUrl, "Organization", identifierParams).then(
        (resources) => ({ ...server, resources })
      )
    ];
  });
  const settled = await Promise.allSettled(searches);
  if (settled.every((result) => result.status === "rejected")) {
    throw new Error("No configured FHIR Organization endpoint could be reached.");
  }
  const organizations = settled.flatMap((result) =>
    result.status === "fulfilled"
      ? result.value.resources.flatMap((resource) => {
          const organization = organizationFromFhir(
            resource,
            result.value.baseUrl,
            result.value.label
          );
          return organization ? [organization] : [];
        })
      : []
  );
  return [
    ...new Map(
      organizations.map((organization) => [
        organization.fhirReference,
        organization
      ])
    ).values()
  ].sort((left, right) => left.name.localeCompare(right.name));
}
