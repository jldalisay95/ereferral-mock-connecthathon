## Summary

Describe the user-visible or conformance change and the active IG assumptions.

## Verification

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run build:ready`
- [ ] Participant mode still blocks every external FHIR mutation
- [ ] Ready-mode writes require successful non-blocking validation
- [ ] UI behavior was checked in both presets when applicable

## Data safety

- [ ] This change contains synthetic data only
- [ ] No credentials, tokens, cookies, private endpoints, or patient information are included
- [ ] New participant-editable conformance values are documented in the central config and IG mapping
