# Contributing

Thank you for helping improve this synthetic PHeRef Connectathon tool.

## Before opening a change

1. Fork the repository and create a focused branch.
2. Use synthetic data only. Never add patient information, real credentials,
   access tokens, private endpoint secrets, or exported browser storage.
3. Put event-specific profiles, identifiers, terminology, and endpoints in
   `src/config/connectathon.config.ts` instead of scattering constants.
4. Keep the participant preset safe: metadata, reads, expansions, preview, and
   `$validate` may run, but external mutations must remain blocked at the FHIR
   service boundary.
5. Document IG assumptions and attach a redacted OperationOutcome when fixing
   conformance behavior.

## Required checks

```powershell
npm ci
npm run lint
npm run test
npm run build
npm run build:ready
```

Open a pull request against `main` and complete the privacy and validation
checklist in the template. Small, reviewable changes are preferred.

## Security and clinical use

This project is not a production EMR, identity system, consent service, or
secure clinical transport. See [SECURITY.md](SECURITY.md) for responsible
reporting instructions.
