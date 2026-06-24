# Local EMR eReferral Mock

A React and TypeScript facility workflow demo for the June 2026 Philippines
FHIR Connectathon. It demonstrates local patient registration, referral
creation, PHeReF Bundle validation and submission, receiving-facility response,
notifications, tracking, timeline review, and printing.

This is a Connectathon mock, not a production EMR. Use synthetic data only.

## Source of truth

- [PHeReF Implementation Guide](https://build.fhir.org/ig/ph-ereferral-organization/ph-ereferral/en/)
- [PHeReF Referral Workflow](https://build.fhir.org/ig/ph-ereferral-organization/ph-ereferral/en/referral-workflow.html)
- [PHeReF Logical Information Model](https://build.fhir.org/ig/ph-ereferral-organization/ph-ereferral/en/logical-information-model.html)
- [June 2026 Connectathon repository](https://github.com/UPM-NTHC/June-2026-Philippines-FHIR-Connectathon)
- [Connectathon acceptance criteria](https://docs.google.com/spreadsheets/d/1Z5k79KtCGaK5sJ5h9yKbku5epo10e-jmrLpsPp3-z4U/edit?gid=1488466081#gid=1488466081)

The generated Bundle follows the v0.1 profiles currently loaded by the
Connectathon validation server:

- Referral category: `ServiceRequest.category` using Emergency or Outpatient
- Urgency: `ServiceRequest.priority`
- Requested service: `ServiceRequest.code`
- Service type compatibility: `ServiceRequest.reasonCode`
- Clinical reason: coded Condition referenced by `ServiceRequest.reasonReference`
- Time called: draft mapping to `ServiceRequest.occurrenceDateTime`

## Install and run

Requirements: Node.js 20 or later and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Demo accounts

All accounts use password `demo123`.

| Username | Facility | Role |
|---|---|---|
| `kalibo` | Kalibo Health Center | Facility user |
| `drstmh` | Dr. Rafael S. Tumbokon Memorial Hospital | Facility user |
| `southcotabato` | South Cotabato Demo Facility | Facility user |
| `admin` | Connectathon Administration | Read-all and endpoint configuration |

Credentials and browser sessions are mock data stored locally. They do not
provide production authentication or authorization.

## Contextual facility behavior

Facility roles are determined per referral:

- The logged-in facility is the initiating facility when its organization ID
  matches `referringOrganizationId`.
- The same facility is the receiving facility when its organization ID matches
  `receivingOrganizationId`.
- Facility users can therefore have records in both Sent Referrals and Incoming
  Referrals.
- Only the receiving facility for a referral can record receiving responses or
  care status updates.

Admin can review all local records but cannot perform facility workflow actions.

## Referral demonstration

### Send a referral

1. Sign in as `kalibo`, `drstmh`, or `southcotabato`.
2. Open Patient Registry to search, add, or update a synthetic patient.
3. Open Generate Referral and select a patient.
4. Record assessment details and confirm that local referral criteria are met.
5. Record local patient or representative consent.
6. Select another facility as the receiving destination.
7. Review category, priority, requested service, clinical reason, time called,
   notes, practitioners, and signature placeholder.
8. Preview and validate the generated transaction Bundle.
9. Submit in Demo mode and open the referral detail or print view.

### Receive and update a referral

1. Sign out and sign in as the selected receiving facility.
2. Open Incoming Referrals. New records are highlighted and have an unread
   notification.
3. Open the referral to acknowledge the notification.
4. Review patient, routing, clinical, Task, timeline, and raw FHIR information.
5. Select a receiving response or care status and enter required remarks.
6. Submit the update and sign back into the initiating facility to see the new
   status and notification.

Supported receiving responses:

- received
- accepted
- rejected
- referred-onward

Supported local care states:

- arrived
- admitted
- ER observation
- other care
- discharged

Care states do not define a new PHeReF code system. Arrived, admitted, ER
observation, and other care map to `Task.status = in-progress`. Discharged and
workflow closure map to `Task.status = completed`. The most recent PHeReF
receiving response remains in `Task.businessStatus`.

## Patient Registry and walk-ins

The registry is local and facility-scoped. It supports searches by first name,
last name, birth date, PhilSys ID, and PhilHealth ID. Duplicate warnings use
identifiers and name plus birth date.

Walk-in records can use a temporary name and unknown demographics. They can
later link to a full local profile. Because the current ERefPatient profile
requires patient name, administrative gender, and birth date, incomplete
walk-in records cannot be submitted as an eReferral.

## Logical information model

The UI and local data model follow the PHeReF logical groups:

- Patient identity: Patient Registry, referral summary, and `Patient`.
- Sending context: logged-in facility, practitioner, PractitionerRole, and
  `ServiceRequest.requester`.
- Receiving context: selected facility and `ServiceRequest.performer` or
  `Task.owner`.
- Referral request: referral category, priority, requested service, date, time called,
  and notes on `ServiceRequest`.
- Clinical reason and context: Condition, Observation, Procedure, and
  `ServiceRequest.reasonReference` or `supportingInfo`. The requested service
  is also repeated in `reasonCode` for compatibility with the active v0.1
  validator binding.
- Workflow and response: Task status, business status, notifications, and
  timeline.
- Audit and provenance: Provenance, `ServiceRequest.relevantHistory`, actor,
  timestamp, and synthetic signature placeholder.

Consent and the referral-criteria decision are local metadata because PHeReF
v0.1 does not define a formal mapping for them.

## FHIR transaction behavior

The Bundle uses matching `urn:uuid` references.

Reusable resources use conditional PUT when a stable identifier is available:

- Patient
- Practitioner
- PractitionerRole
- Organization

Patients without PhilSys or PhilHealth identification use POST. Event resources
use POST:

- ServiceRequest
- Encounter
- Condition
- Observation
- Procedure
- DiagnosticReport
- Task
- Provenance

DiagnosticReport carries synthetic attachment metadata but is not referenced by
`ServiceRequest.supportingInfo`, because the current profile does not permit
DiagnosticReport at that path.

## Validation and endpoints

Defaults:

```dotenv
VITE_PHEREF_BASE_URL=https://cdr.pheref.fhirlab.net/fhir
VITE_PHCORE_BASE_URL=https://cdr.phcore.fhirlab.net/fhir
VITE_TX_BASE_URL=https://tx.fhirlab.net/fhir
```

Bundle validation uses `POST {PHeReF CDR}/Bundle/$validate`. The app parses
`OperationOutcome.issue.severity`; fatal and error issues are blocking, while
warning and information issues are non-blocking. HTTP 200 alone is not treated
as successful validation.

Demo mode is enabled by default. It permits metadata, terminology, search, and
validation calls but resolves referral submissions and Task writes locally.
Only Admin can disable Demo mode and enable external writes.

## Notifications, timeline, and print

Submitting a referral creates an unread notification for the receiving
facility. Receiving-side updates create a notification for the initiating
facility. Notifications persist in localStorage and are limited to the current
browser profile.

The `ui-polish-notification-sound` branch adds a header notification bell with
an unread badge, a recent-notification dropdown, and a subtle Web Audio chime
for newly arriving unread notifications. The chime is generated locally, does
not loop, and may be blocked by the browser until the user interacts with the
page. Users can mute or unmute notification sound from the notification
dropdown; the preference is stored in localStorage. Visual badges and unread
styles remain available whether sound is on or off.

The timeline records assessment, criteria, consent, draft creation, validation,
submission, receiving responses, care states, closure, and update failures.

Every referral detail page links to a browser print view containing patient,
routing, clinical, consent, status, and synthetic signature information.

## Quality checks

```powershell
npm run lint
npm run test
npm run build
```

Vitest is limited to tests under `src/` and excludes generated or tool-managed
directories such as `.trunk`, `dist`, and `artifacts`.

## Known limitations

- PHeReF and PH Core remain draft specifications.
- Back-referral is not implemented for the v0.1 workflow.
- Referred-onward records an outcome and destination but does not automatically
  create a replacement ServiceRequest.
- Consent is local metadata and is not a formal FHIR Consent profile.
- Attachment security and complete exchange behavior are not implemented.
- Final facility and network identification policy remains outside this demo.
- Non-response, SLA, transport, production security, and policy endorsement are
  out of scope.
- Notifications are not delivered across browsers or devices.
- The signature is a synthetic Provenance placeholder, not a cryptographic
  signature.
