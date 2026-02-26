# Security Policy

## Reporting a Vulnerability

Please do not open public GitHub issues for security vulnerabilities.

Report security concerns privately via:

- Website contact page: https://www.openalmond.com/contact-us

Include:

- A clear description of the issue
- Reproduction steps
- Potential impact
- Any suggested fix

## Response Goals

- Initial acknowledgement: within 7 business days
- Triage and severity assessment: as soon as practical
- Remediation and deployment: prioritized by severity and operational risk

## Scope

Security reports are accepted for:

- Production website behavior
- API endpoints
- Authentication/session/data exposure issues
- Supply chain and dependency vulnerabilities with real impact

## CSP Rollout

The site supports staged CSP rollout modes via `CSP_MODE`:

- `compat` (default): enforce compatibility CSP + report stricter CSP violations.
- `report-only`: disable enforced CSP and keep strict CSP in report-only mode.
- `strict`: enforce strict CSP and keep strict policy reporting enabled.

Violation reports are sent to `/api/csp-report` and logged server-side during
phased hardening.
