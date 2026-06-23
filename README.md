# PHeRef Facility eReferral Connectathon Prototype

A local React/TypeScript EMR mock application for demonstrating the June 2026 Philippines FHIR Connectathon eReferral workflow from both referring- and receiving-facility perspectives.

This is not a production EMR. All patient information must remain synthetic.

## Source of truth

- [PH eReferral Implementation Guide](https://build.fhir.org/ig/ph-ereferral-organization/ph-ereferral/en/)
- [June 2026 Philippines FHIR Connectathon repository](https://github.com/UPM-NTHC/June-2026-Philippines-FHIR-Connectathon)
- [PHeRef acceptance criteria](https://docs.google.com/spreadsheets/d/1Z5k79KtCGaK5sJ5h9yKbku5epo10e-jmrLpsPp3-z4U/edit?gid=1488466081#gid=1488466081)

The implementation follows the published profile where the acceptance table conflicts:

- Referral category → `ServiceRequest.category`
- Reason for referral / service type → `ServiceRequest.reasonCode`

## Install and run

Requirements: Node.js 20+ and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Demo accounts

The login page uses an account picker and no passwords.

| Username | Role | Facility |
|---|---|---|
| `kalibo` | Referring facility | Kalibo Health Center, NHFR 3056 |
| `drstmh` | Receiving facility | Dr. Rafael S. Tumbokon Memorial Hospital, NHFR 513 |
| `admin` | Administration/read-all | Connectathon Administration |

Sessions are stored in browser localStorage for demo purposes only.

## Routes

- `/login` — mock facility login
- `/dashboard` — role-specific dashboard
- `/referrals/new` — referring-facility referral form
- `/referrals/preview` — Bundle preview, validation, and submission
- `/referrals` — facility-scoped referral tracker
- `/referrals/:id` — referral detail, timeline, and receiving workflow actions
- `/inbox` — receiving-facility inbox and notifications
- `/referrals/search` — remote FHIR search
- `/terminology` — required ValueSet expansion
- `/settings` — admin endpoint and Demo-mode configuration

## Referring-facility workflow

1. Log in as `kalibo`.
2. Select **New Referral**.
3. The initiating organization and practitioner are populated from the current facility.
4. Select the receiving facility and complete the synthetic referral.
5. Open **Preview FHIR Bundle**.
6. Validate using `POST /Bundle/$validate`.
7. Submit the referral.
8. Open **Sent Referrals** to track status changes.

The generated transaction contains 21 entries:

- 7 conditional PUT master-data entries
- 14 POST clinical, referral, Task, and Provenance entries

All intra-Bundle references use matching `urn:uuid` fullUrls.

## Receiving-facility workflow

1. Log out and select `drstmh`.
2. The dashboard and Inbox show the new referral and unread notification badge.
3. Opening the referral marks its notification read.
4. Review demographics, clinical details, Task data, validation output, Bundle JSON, and timeline.
5. Update the referral to Received, Accepted, Rejected, Referred onward, or Completed.
6. Rejection and onward referral require a reason; onward referral also requires a destination facility.
7. Log back in as `kalibo` to see the status update and referring-facility notification.

## Demo mode and live mode

Demo mode is enabled by default:

- `/metadata`, terminology operations, remote search, and validation can call live servers.
- Bundle submission is resolved locally into a transaction-response-shaped Bundle.
- Local resource IDs are generated and all `urn:uuid` references are rewritten to relative references.
- Task updates modify the locally stored full Task resource.
- No referral POST or Task PUT is sent externally.

Admin can turn Demo mode off under **Settings**. Live mode:

- submits the transaction Bundle to the PHeRef CDR;
- captures IDs from `entry.response.location`;
- reads the current Task, modifies it, and PUTs the complete Task resource;
- preserves prior local state and records an error timeline event if the remote update fails.

No automatic polling is used. Live records have a manual Task refresh action.

## Notifications and status tracking

Submitting a referral creates an unread notification for the receiving organization. Opening or receiving the referral marks it read. Receiving-facility status updates create a notification for the referring organization.

Each referral stores an ordered timeline containing:

- Draft
- Validated or validation error
- Submitted
- Requested
- Received
- Accepted, Rejected, or Referred onward
- Completed
- Remote errors when applicable

The tracker is scoped by role:

- Referring users see referrals they created.
- Receiving users see referrals assigned or forwarded to their facility.
- Admin sees all local referrals.

## Local persistence model

A versioned localStorage repository stores:

- current session;
- endpoint and Demo-mode settings;
- one active draft per referring account;
- durable referral records and local FHIR resources;
- transaction responses and resource references;
- validation summaries and OperationOutcome resources;
- timeline events;
- notifications and read state.

Legacy endpoint settings and compact receipts are migrated where sufficient draft data is available.

## FHIR endpoints

```dotenv
VITE_PHEREF_BASE_URL=https://cdr.pheref.fhirlab.net/fhir
VITE_PHCORE_BASE_URL=https://cdr.phcore.fhirlab.net/fhir
VITE_TX_BASE_URL=https://tx.fhirlab.net/fhir
```

Admin can override these values locally.

## Validation behavior

- HTTP status alone is never treated as validation success.
- `OperationOutcome.issue.severity` is counted.
- Fatal and error issues are blocking.
- Warning and information issues are non-blocking.
- Diagnostics are deduplicated for readability while raw severity counts are retained.
- “Submit anyway for demo” requires explicit acknowledgement.

## Quality checks

```powershell
npm run lint
npm run test
npm run build
```

Tests cover FHIR builders, terminology URLs, OperationOutcome parsing, Task transitions, session persistence, facility scoping, notifications, Demo-mode transaction resolution, and the complete referring-to-receiving UI workflow.

## Known limitations

- PHeRef and PH Core are draft specifications under active development.
- The PWD disability ValueSet currently returns HTTP 404 from the configured terminology server.
- PSGC fields use the Connectathon canonical, but the app does not bundle the full national selector.
- Authentication, authorization, encryption, audit security, and production persistence are intentionally out of scope.
- Notifications work within the same browser/localStorage profile; there is no cross-device delivery.
- Admin is read-all/configuration only and cannot perform facility workflow actions.
- The Provenance signature is a clearly synthetic placeholder rather than a cryptographic signature.
