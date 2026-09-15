# Participant Starter: fork, configure, validate

Use this track when your Connectathon team does not yet have an eReferral EMR,
or while adapting a fork to the IG selected for the event. It is the default
and cannot send external FHIR writes.

## 1. Fork and start safely

```powershell
git clone https://github.com/YOUR-ACCOUNT/ereferral-mock-connecthathon.git
cd ereferral-mock-connecthathon
npm install
npm run dev
```

The header must show **Participant starter**. The app can read remote resources,
expand terminology, construct and preview a Bundle, and call `$validate`.
Transaction POSTs, resource PUT/PATCH, facility-registration writes, and Task
updates are denied at the FHIR client boundary even if old localStorage says
Demo mode is off.

Select **Create a facility account** on the login page to create a synthetic
facility and local login. Complete the PSGC selections and use a disposable
demonstration password. Signup is local in both presets and never publishes an
Organization.

## 2. Edit the conformance configuration

Open `src/config/connectathon.config.ts` and search for
`EDIT FOR YOUR FORK`. Update the values agreed for the active test track:

- PHeRef, PH Core, and terminology endpoints
- IG and expected FHIR versions and documentation links
- StructureDefinition and extension canonicals
- identifier and CodeSystem URLs
- ValueSet canonicals and development-only fallback codes
- PSGC system, ValueSets, release version, and the optional address-extension flag

Standard FHIR constants and preset capability definitions are separated from
these editable blocks. Do not add credentials to this file.

For local endpoint-only overrides, copy `.env.example` to
`.env.participant.local`. `VITE_*` values are public browser configuration, not
a place for API keys or patient data.

## 3. Prove readiness

Sign in, open **Connectathon Guide**, and run the checks. Resolve every item:

1. Endpoint and canonical URL syntax
2. CapabilityStatement availability and expected FHIR version
3. Required StructureDefinition availability
4. Live ValueSet expansion
5. Live PSGC expansion and version compatibility
6. Transaction Bundle construction
7. Latest non-blocking `$validate` result

Fallback terminology is useful when building forms but does not count as live
terminology readiness. If PSGC expansion omits entry-level versions, confirm the
release with the Connectathon test lead before enabling optional extensions.

## 4. Graduate deliberately

The checklist never enables writes. Stop the participant server and follow the
[Connectathon Ready guide](CONNECTATHON_READY.md). Keep using the same edited
conformance configuration; do not maintain a second implementation branch.
Your self-registered facility remains in the same browser after the restart.
