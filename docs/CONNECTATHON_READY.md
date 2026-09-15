# Connectathon Ready: send and receive

Use this preset only after the Participant Starter checklist passes against the
active IG and servers.

```powershell
npm run dev:ready
```

Confirm the header shows **Connectathon ready**, sign in, and open
**Connectathon Guide** once more. The preset enables write capability but does
not bypass validation: submission requires the latest Bundle `$validate` result
to be completed and non-blocking.

## Live terminology is mandatory

Ready mode obtains every configured form ValueSet with a read-only
`GET {terminologyBaseUrl}/ValueSet/$expand?url={canonical}` request. This
includes referral category, referral service type, practitioner role, patient
relationship, PWD disability type, administrative gender, request priority,
and the PSGC address ValueSets. An error or empty expansion disables the
affected action; Ready mode never substitutes bundled terminology or the PSGC
snapshot.

The application does not create, update, or delete CodeSystem or ValueSet
resources on the terminology server. Configure the endpoint and canonical URLs
in `src/config/connectathon.config.ts`, then use **Terminology Check** and
**Connectathon Guide** to diagnose server availability.

## Publish a self-registered facility

Facility signup is always local. For a self-registered facility, open
**Connectathon Guide**, review the configured PHeRef endpoint, and choose
**Validate and publish Organization**. Confirm the destination. The app calls
`Organization/$validate` and publishes an NHFR conditional transaction only
when the result is non-blocking. Repeating the action updates the same logical
Organization. Validation and network failures leave the local account intact.

## Send a referral

1. Sign in as a facility user and select or create a synthetic patient.
2. Generate a referral and complete referral criteria and consent.
3. Select the destination, terminology, clinical context, and practitioners.
4. Preview the generated transaction Bundle.
5. Run `$validate` and resolve fatal/error issues.
6. Submit the Bundle to the configured PHeRef endpoint.
7. Review the transaction response, resource references, and timeline.

## Receive and update

1. Sign in as the receiving facility.
2. Open Incoming Referrals and use **Refresh live incoming** if required.
3. Open the referral and review its ServiceRequest and Task.
4. Record a receiving response or care status with required remarks.
5. Submit the Task update and verify it from the initiating facility.

Admin Settings retains endpoint overrides and reset-to-fork-default behavior.
Admin facility creation is also local first and does not replace the Admin
session. Admin can explicitly publish user-created facilities. Demo mode can be
selected in the ready preset for local workflow rehearsal and disables
Organization publishing; it cannot enable writes in the participant preset.

This is a synthetic Connectathon tool. It is not a production EMR,
authentication system, consent service, or secure clinical transport.
