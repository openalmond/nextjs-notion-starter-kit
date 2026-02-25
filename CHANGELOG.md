# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- `collectionRowHydrationLimit` config flag for phased collection-row hydration caps (default: `null`, disabled).
- GitHub-facing project docs: `LICENSE.md`, `PRIVACY.md`, `SECURITY.md`.
- `Content-Security-Policy-Report-Only` header and `/api/csp-report` endpoint for non-breaking CSP telemetry.

### Changed

- Kept repository license as MIT and updated docs to reflect MIT + additional content/brand notice.
- Updated `readme.md` and `contributing.md` for current maintainer workflow.
- Enabled canary cap `collectionRowHydrationLimit: 24` in `site.config.ts` for phased collection hydration testing.
- Migrated icon imports from legacy `@react-icons/all-files` to `react-icons/*` and removed the deprecated package.
- Added a TTL + in-flight dedupe cache for tag post indexing to reduce first-hit tag archive latency.
- Added enforced low-risk CSP baseline (`base-uri`, `frame-ancestors`, `object-src`, `form-action`) while keeping broad CSP in report-only mode.
- Removed global `react-icons` context provider to eliminate icon style hydration mismatch warnings.
- Allowed MailerLite stylesheet domain in CSP report-only `style-src` to reduce false-positive noise.
- Added page-specific collection hydration caps canary for home/blog to reduce large-page-data risk while keeping global fallback.
- Reduced record-map payload bloat by removing compact-ID alias duplication in normalization.
- Updated core runtime deps in-place (Notion stack, React patch level, analytics, `ky`, `react-tweet`, `posthog-js`) and refreshed lockfile.
- Applied compatibility typing updates for newer Notion type surfaces in `NotionPage`, ACL, feed, oEmbed, and social-image paths.
- Cleared npm audit findings (`0` vulnerabilities) after targeted `npm audit fix` on transitive tooling deps.
- Promoted a compatibility-safe full CSP to enforced mode and kept a stricter candidate policy in report-only telemetry.
- Expanded SEO metadata with stronger robots hints, richer social tags, and Organization/WebSite JSON-LD.
- Redesigned `/api/social-image` output to a more modern OG/Twitter card layout with title/summary emphasis.
- Enhanced sitemap output with deduped URLs, XML escaping, and per-page `lastmod` / `priority`.
- Refreshed web app and iOS icon assets with dark backgrounds and increased safe padding for Android maskable icons.

## [2026-02-25]

### Security

- Hardened `/api/search-notion` input validation and error handling.
- Added safe global response security headers in `next.config.js`.

### Reliability

- Fixed search warm-up behavior to avoid `400 Bad Request` runtime failures.
- Fixed nested anchor hydration issues in Notion collection cards.
- Fixed React key warning path in custom `propertySelectValue` override.
- Fixed hook-order regression in `NotionPage`.

### Performance

- Migrated to modern `next/image` path for Notion rendering with feature-flag staging.
- Added preview-image generation dedupe/filter logic and removed noisy preview logs.
- Disabled preview image support by default in `site.config.ts` for faster builds and smaller payloads.

### SEO

- Expanded page metadata: keywords, article publish/modify times, locale, and richer JSON-LD `BlogPosting`.

### Tooling

- Aligned Next.js dependency declaration with installed runtime (`16.1.6`).
- Disabled dev indicator path that triggered noisy HMR overlay errors.
