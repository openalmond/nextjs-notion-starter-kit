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

The site currently runs a `Content-Security-Policy-Report-Only` header to
collect compatibility data before enforcement.

- Violation reports are sent to `/api/csp-report`
- Reports are logged server-side for review during phased hardening
