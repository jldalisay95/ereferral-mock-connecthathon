# Configuration to FHIR / IG mapping

The in-app **Connectathon Guide** shows these values after Admin or environment
endpoint overrides. Fork defaults are edited in
`src/config/connectathon.config.ts`.

| Configuration key | Generated or tested FHIR location |
|---|---|
| `endpoints.pherefBaseUrl` | `CapabilityStatement`, `Bundle/$validate`, transaction Bundle POST, PHeRef reads, and Task PUT |
| `endpoints.phCoreBaseUrl` | PH Core `CapabilityStatement` and `StructureDefinition?url=` checks |
| `endpoints.terminologyBaseUrl` | `ValueSet/$expand` and PSGC checks |
| `ig.version` | Readiness display and terminology cache key |
| `ig.fhirVersion` | Expected `CapabilityStatement.fhirVersion` |
| `profiles.*` | Corresponding resource `meta.profile[0]`; also queried with `StructureDefinition?url=` |
| `extensions.*` | Optional PH Core geographic `Address.extension.url` values |
| `identifierSystems.philHealth` | `Patient.identifier.system` |
| `identifierSystems.philSys` | `Patient.identifier.system` |
| `identifierSystems.nhfr` | `Organization.identifier.system` and conditional transaction URL |
| `identifierSystems.hcpn` | `Organization.identifier.system` |
| `identifierSystems.prc` | `Practitioner.identifier.system` |
| `identifierSystems.referral` | Referral/ServiceRequest identifier system |
| `codeSystems.workflow` | `Task.businessStatus.coding.system` and workflow status reasons |
| `codeSystems.psgc` | Optional geographic extension `valueCoding.system` |
| `psgc.version` | Optional geographic extension `valueCoding.version`, readiness compatibility, and cache key |
| `psgc.valueSets.*` | Region, province, city/municipality, barangay, and all-PSGC live expansions |
| `terminology.valueSets.*.canonical` | Live `ValueSet/$expand?url=` requests |
| `terminology.valueSets.*.fallbackOptions` | Form development only; never sufficient for ready status |
| `features.includePsgcExtensions` | Includes/omits PH Core Address extensions while retaining standard FHIR address fields |
| build preset | Service-boundary capability for transactions, PUT/PATCH, registration writes, and Task updates |
| self-registration facility fields | Local `Organization`, default `Practitioner`, `PractitionerRole`, and synthetic facility account |
| explicit Organization publish | `POST {PHeRef}/Organization/$validate`, followed by an NHFR conditional PUT inside a transaction Bundle |

Terminology cache keys include endpoint, canonical, IG version, PSGC version,
and preset, preventing expansions from an old configuration from being reused.
