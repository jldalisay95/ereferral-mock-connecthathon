# PHeRef Local EMR + eReferral Prototype

A browser-only React/TypeScript demonstration app for the June 2026 Philippines FHIR Connectathon. It creates, validates, submits, retrieves, and updates one synthetic eReferral using FHIR R4 and the draft PHeRef profiles.

This is not a production EMR. Do not enter real patient information or protected health information.

## Source of truth

- [PH eReferral Implementation Guide](https://build.fhir.org/ig/ph-ereferral-organization/ph-ereferral/en/)
- [June 2026 Philippines FHIR Connectathon repository](https://github.com/UPM-NTHC/June-2026-Philippines-FHIR-Connectathon)
- [PHeRef acceptance criteria](https://docs.google.com/spreadsheets/d/1Z5k79KtCGaK5sJ5h9yKbku5epo10e-jmrLpsPp3-z4U/edit?gid=1488466081#gid=1488466081)

The implementation follows the published profile and example where the acceptance table conflicts:

- Referral category → `ServiceRequest.category`
- Reason for referral / service type → `ServiceRequest.reasonCode`

The table’s `ServiceRequest.priority` / `ServiceRequest.category` mapping cannot carry the published SNOMED value sets correctly and is documented in the UI.

## Features

- Endpoint health checks through `/metadata`
- Configurable PHeRef, PH Core, and terminology server URLs
- Required terminology expansion with session caching and visible fallback errors
- Synthetic patient, practitioners, roles, organizations, referral, clinical data, Task, and Provenance
- 21-entry transaction Bundle:
  - 7 conditional PUT master-data entries
  - 14 POST referral/clinical/workflow entries
- Bundle preview, JSON copy, `$validate`, OperationOutcome severity parsing, and submission
- Transaction-response resource ID capture
- Referral search by patient identifier/name, ServiceRequest status/subject, and Task status/focus
- Receiving-facility clinical summary and full-resource Task PUT updates
- Local browser persistence for draft, endpoint overrides, and recent receipts

## Requirements

- Node.js 20 or newer
- npm
- Browser access to the configured FHIR endpoints

## Setup and run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

Environment variables:

```dotenv
VITE_PHEREF_BASE_URL=https://cdr.pheref.fhirlab.net/fhir
VITE_PHCORE_BASE_URL=https://cdr.phcore.fhirlab.net/fhir
VITE_TX_BASE_URL=https://tx.fhirlab.net/fhir
```

The Dashboard can override these values locally without changing `.env`.

## Connectathon demo workflow

1. Open **Dashboard** and confirm all three `/metadata` checks are online.
2. Open **Terminology Check** and expand all required value sets.
3. Note that the PWD disability expansion may return HTTP 404. This is shown as a non-blocking warning.
4. Open **New Referral**, review the synthetic demo case, and change fields if required.
5. Open **Preview & Submit**.
6. Inspect the human-readable summary and transaction Bundle JSON.
7. Select **Validate Bundle**. HTTP 200 is not treated as success by itself; every `OperationOutcome.issue.severity` is inspected.
8. Resolve fatal/error issues before submission. Warnings and information remain visible but do not block.
9. Select **Submit transaction**. This performs:

   ```http
   POST https://cdr.pheref.fhirlab.net/fhir
   Content-Type: application/fhir+json
   ```

10. Review the transaction-response Bundle and locally stored resource IDs.
11. Open **Search Referrals** and search using a returned patient identifier, ServiceRequest status, or Task status/focus.
12. Open the clinical summary and then the receiving-facility view.
13. Advance the Task through `received`, `accepted`, and `completed`, or record `rejected` / `referred-onward` with an explanatory note.

## Validation behavior

- Resource validation: `POST /{resourceType}/$validate`
- Bundle validation: `POST /Bundle/$validate`
- `fatal` and `error` are blocking.
- `warning` and `information` are non-blocking.
- HTTP 422 OperationOutcome responses are parsed and displayed.
- Network/capability failures mark the Bundle as unvalidated. A user must explicitly acknowledge an unvalidated synthetic demo submission.

## FHIR construction notes

- All internal transaction references use `urn:uuid` values matching `Bundle.entry.fullUrl`.
- Patient, Practitioner, PractitionerRole, and Organization data use conditional PUT by identifier.
- ServiceRequest, Encounter, two Conditions, six Observations, Procedure, DiagnosticReport, Task, and Provenance use POST.
- Confirmed PHeRef profiles are included in `meta.profile`.
- PH Core Practitioner and Organization profiles are included.
- DiagnosticReport omits `meta.profile` because no PHeRef DiagnosticReport profile is published.
- The PWD extension uses nested `pwdId`, `disabilityType`, and `idExpirationDate` extensions.
- The Provenance signature is synthetic base64 data, not a cryptographic signature.

## Quality checks

```powershell
npm run lint
npm run test
npm run build
```

Tests cover Bundle entry strategy and references, identifier/profile constants, clinical codes and UCUM units, PWD extension shape, Task workflow mappings, OperationOutcome handling, terminology URLs, transaction receipts, reference parsing, and a UI smoke test.

## Known limitations

- PHeRef and PH Core are draft specifications under active development.
- The published PHeRef package inspected for this implementation is version 0.1.0, built June 20, 2026.
- The Connectathon repository was updated June 23, 2026.
- The PWD disability ValueSet currently returns HTTP 404 from the configured terminology server.
- The published sample Bundle has 21 entries although some narrative text says 20.
- PSGC text/code fields use the Connectathon repository canonical
  `https://fhir.doh.gov.ph/phcore/CodeSystem/PSGC`, but the app does not bundle a
  43,770-concept selector.
- Retrieval intentionally uses portable two-stage searches and direct reads instead of `_include`.
- There is no authentication, authorization, national registry integration, production persistence, billing, or analytics.
- Browser local storage is for synthetic demo state only and can be cleared through browser developer tools.

## Recommended next improvements

- Replace manual coded fields with terminology-backed autocomplete after PWD expansion is corrected.
- Add a compact PSGC lookup dataset or approved terminology search.
- Add server-specific optimistic concurrency using `If-Match`.
- Add exportable Connectathon QA evidence containing requests, responses, and validation summaries.
