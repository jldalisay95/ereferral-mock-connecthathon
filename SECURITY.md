# Security Policy

## Supported use

This repository is a synthetic Connectathon tool. No version is approved for
production clinical use, real patient data, real credentials, or security-
critical workflows.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, credential, or data
exposure. Use GitHub's private **Report a vulnerability** flow on the Security
tab. Include reproduction steps using synthetic data and redact tokens,
cookies, patient details, and private endpoint information.

The repository owner will acknowledge the report, assess affected branches and
releases, and coordinate remediation before public disclosure. If private
reporting is unavailable, contact the repository owner through the contact
method on their GitHub profile without including sensitive details initially.

## Configuration safety

- `VITE_*` values are delivered to the browser and must never contain secrets.
- `.env`, `.env.local`, and `.env.*.local` are ignored and must remain untracked.
- Browser-local accounts are demonstration data, not real authentication.
- The participant preset must continue to reject transaction, PUT, PATCH, and
  other external write requests at the service boundary.
