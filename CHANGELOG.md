# Changelog

## 0.1.1 — 2026-08-27

- Fix duplicate-title comparison so a surviving note cannot hide a lost sibling.
- Match attachments solely by SHA-256 fingerprint and occurrence count; filename and size no longer mask changed bytes.
- Add source-relative collision labels, schema 2 reports (with schema 1 read compatibility), exact CLI/browser regression tests, and static-site CSP/cache policy.

## 0.1.0 — 2026-08-27

- Initial local directory and ZIP inventory CLI.
- Source-to-destination loss comparison with JSON output and CI exit codes.
- Static documentation site with private browser demo and one-time paid unlock.
