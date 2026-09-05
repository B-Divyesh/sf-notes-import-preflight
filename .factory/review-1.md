# Inspect notes exports before migration — review 1

## Verdict: FAIL

The product has **9 findings** and **18 untested public claims**. A PASS requires zero of both.

- Live URL: https://notes-import-preflight.sociobot.in/
- Reviewed implementation: `f61ea634c3a956a46a682632fab67fd6238ce8cd`
- Reviewed documentation: `b4860b0906af7671e98e751ad1ea38b15cfde75b`
- Product version: `0.1.1`
- Review date: 2026-09-05 UTC
- Live HTML SHA-256: `e4e7fda13f26c9d1d44189e0be6958ad7a9efe804d5c395dfed00fd7f49a03b8`

Only `.factory/handoff.md` and `.factory/verification-2.md` changed after the implementation commit. A fresh build produced the same HTML SHA-256 as the live page, so the live product is the reviewed implementation.

## First screen

Fresh 1440×900 desktop and 390×844 phone browsers showed the same first-screen content.

- Job: clear. It inventories a notes export and compares the destination for loss.
- Audience: missing. The first screen does not name people moving years of notes or another specific user situation.
- First action: “Inspect a folder.” It is clear, but it asks for real files instead of offering the required sample.
- Facts: “No account. No upload. No telemetry.” appear before scrolling.

There was no horizontal overflow at either size. Screenshots are `/work/.evidence/desktop-landing.png`, `/work/.evidence/phone-landing.png`, and `/work/.evidence/phone-populated.png`.

## Findings

### F-01 — P1 — The required sample demo does not exist

There is no “Try it with sample data” action, sample data, demo label, reset action, or “Start for real” action. `/demo` returns the ordinary landing page. The CLI has only `scan` and `compare`; it has no `demo` or `--demo` command. There is no `examples/` directory and `.factory/demo.md` is missing. The terminal block is static copy, not a recording of the real binary running a shipped sample.

The real browser folder path works and showed 1 notebook, 1 note, 1 attachment, 20 B, and one task risk. Storage remained empty and requests stayed on the product origin. That proves the real local scan, but it does not provide the required isolated sample path or sample reset.

### F-02 — P1 — The public install command fails

The first screen offers `cargo install notes-preflight`. From a fresh Cargo root, that command exited 101 because crates.io has no `notes-preflight` package. The repository also has no GitHub release, while the README tells users to download a release binary without linking one.

Building and installing the locally packed crate worked, but that is not the public path shown to a visitor.

### F-03 — P1 — Purchase is broken and paid features are overstated

The live “Buy Preflight Plus — $19” link returns HTTP 404 with `{"error":"enabled factory product","status":404}`. A buyer cannot purchase.

The unlocked client contains browser comparison only. “Locally saved baselines,” “printable audit sheets,” and a way to obtain “30 days of setup help” appear in copy but have no implementation or user path. An invalid license is rejected correctly, and the comparison workspace handles destination-first, loss, and pass states when opened from a cached valid verdict.

### F-04 — P1 — Public claims have no required claim tests

`.factory/claims.json` is missing and there are no `@claim:` tests. Therefore there were no declared claim commands to run. Eighteen distinct public claim groups remain untested under the claims contract, even where this review obtained supporting ad hoc evidence. The full list is below.

### F-05 — P2 — Invalid browser input is labeled “Complete”

Selecting a folder containing only ignored files shows the correct error text, but the manifest header says “Complete.” The error path first sets “Needs attention,” then the loading cleanup overwrites it because an empty report remains assigned. Selecting a valid folder afterward recovers correctly.

### F-06 — P2 — There is no real 404 route

`/404.html` and `/does-not-exist` both return HTTP 200 and render the landing page. A deliberate 404 response is expected and would not be a defect; the defect is the missing 404 status and missing designed not-found page.

### F-07 — P2 — Required site metadata and shared structure are incomplete

The landing page has no canonical link, Open Graph metadata, Twitter card metadata, or apple-touch icon. The header does not include Privacy and is not consistent with the legal-page header. External links do not say they leave the site. The footer omits “Built by Param Factory” and the version/build id. The sitemap cannot list the required demo and 404 routes because neither exists.

### F-08 — P2 — The words do not follow the plain-words contract

The first screen does not name the audience. Product headings and instructions use the prohibited inspection/cargo metaphor, including “Local migration checkpoint,” “Inspect the cargo,” “Nothing on the belt yet,” “Two manifests. One honest answer,” and “A repeatable migration desk.” `.factory/copy-audit.md` is also missing.

### F-09 — P2 — Some touch targets are narrower than 44 px

At both desktop and phone sizes, the “Try it,” “Plus,” and “Terms” links measured 37×44, 31×44, and 40×44 CSS pixels. The license-field label was 26 px high. Automated axe checks do not cover this manual target-size requirement.

## Untested public claims

All entries below lack the required `.factory/claims.json` record and exactly one matching `@claim:` test.

| ID | Public claim group | Review observation |
|---|---|---|
| UC-01 | CLI scans are local, read-only, and make no network request | Local scans passed; no tagged claim test |
| UC-02 | Browser files, names, contents, and results are not uploaded | No external request during scan; no tagged claim test |
| UC-03 | No telemetry, tracking, advertising cookies, pixels, or third-party scripts | Initial requests were same-origin; no tagged claim test |
| UC-04 | Reports notebook, note, attachment, and byte counts | Observed; no tagged claim test |
| UC-05 | Reports link targets, metadata coverage, and conversion risks | Unit/fixture evidence exists; no tagged claim test |
| UC-06 | Scans directories and ZIP archives | Observed; no tagged claim test |
| UC-07 | Recognizes Apple Notes HTML/Markdown, Obsidian, Joplin, HTML, text, ENEX, and JSON exports | Only partially covered by ordinary tests; no tagged claim test |
| UC-08 | Bounds and streams unsafe archives without extraction | Boundary and traversal paths passed; no tagged claim test |
| UC-09 | Writes schema 2 JSON and reads schema 1 reports | Schema 2 observed; no tagged claim test for compatibility |
| UC-10 | Reports omit note bodies and attachment bytes | Observed for the fixture; no tagged claim test |
| UC-11 | Comparison finds missing or changed notes and missing attachments | Observed; no tagged claim test |
| UC-12 | Duplicate names and same-size different bytes are matched safely | Regression passed; no tagged claim test |
| UC-13 | Exit codes are 0 for success, 1 for invalid input, and 2 for detected loss | Observed; no tagged claim test |
| UC-14 | Encrypted/proprietary exports are refused without account access or encryption bypass | No tagged claim test |
| UC-15 | Browser folder inspection works offline after the first visit | Observed in a fresh offline context; no tagged claim test |
| UC-16 | Plus costs $19 once and is not a subscription | Checkout is broken; no tagged claim test |
| UC-17 | Plus provides comparison, saved baselines, printable sheets, local files, and 30 days of help | Comparison exists; other promised paths are absent; no tagged claim test |
| UC-18 | License verification sends only a token at most daily and locks invalid licenses | Invalid token was locked; no tagged claim test for the whole promise |

Untested claim count: **18**.

## Earlier findings

| Earlier finding | Current disposition | Evidence |
|---|---|---|
| Comparison collapsed duplicate titles and same-name, same-size attachments | Fixed | Collision regression passed; independent loss comparison exits 2 and identifies both losses |
| Hashed assets were not immutable cached | Fixed | Live hashed JS returns `Cache-Control: public, max-age=31536000, immutable`; HTML and service worker revalidate |
| Content-Security-Policy was absent | Fixed | Live responses include the restrictive configured CSP with `frame-ancestors 'none'` as a header |
| Lighthouse could not run in the earlier container | Resolved for this review | Lighthouse mobile completed: performance 100, accessibility 100, best practices 100, SEO 100 |

## Functional and quality evidence

- `npm ci`: PASS; 57 packages, 0 reported vulnerabilities.
- `npm test`: PASS; 3 Vitest tests, 6 Rust unit tests, 1 Rust CLI integration test, and Rust doc tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; produced `dist/site/` and `dist/bin/notes-preflight`.
- `cargo package -p notes-preflight --allow-dirty`: PASS; package verification succeeded.
- Clean consumer install from the packed crate: PASS; `notes-preflight 0.1.1` scanned the fixture.
- Public `cargo install notes-preflight`: FAIL; package not found in crates.io.
- CLI paths: normal directory, ZIP, empty directory, missing input, malformed ZIP, entry count, entry size, total size, zero limit, traversal, identical comparison, loss comparison, saved report, and recovery were exercised. Expected exits and messages were returned.
- Browser paths: empty/invalid selection, recovery, populated scan, JSON export, destination-first recovery, loss, pass, invalid license, reduced motion, offline reload, and offline scan were exercised.
- Browser privacy: scanning added no local/session storage, changed no tracked fixture, and made no external request.
- Keyboard: the phone tab order reached every visible interactive control, began with the skip link, showed a 3 px amber focus ring, and returned to the start without a trap.
- Axe Core 4.10.3: 0 WCAG 2/2.1 A/AA violations in Playwright at desktop and phone sizes. Standalone `@axe-core/cli`: 0 violations.
- Factory `verify-url.sh`: PASS; no console errors, one `h1`, `lang=en`, `main`, alt text, and labeled buttons.
- Reduced motion: media query matched; animation and transition durations were 0.00001 s.
- 200% text: no horizontal overflow at either reviewed viewport.
- Offline: service worker controlled a fresh context; reload and the local folder scan worked offline with no console errors.
- Lighthouse mobile: performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.5 s, CLS 0, total blocking time 10 ms.
- Fresh build sizes: main JS 9,013 B, CSS 15,236 B, fonts 57,020 B total, phone hero 22,084 B.
- Live headers: CSP, HSTS, `nosniff`, referrer policy, permissions policy, frame denial, correct HTML/service-worker revalidation, and immutable hashed assets are present.
- Legal pages: `/privacy/` and `/terms/` return 200, have route-specific titles, one `h1`, a `main`, and working return links.
- Static product: tenant isolation, SQLite restart persistence, product health API, and 429/`Retry-After` checks are not applicable. The billing API is external to this product and was checked only through this product's public checkout and fake invalid-license paths.

## Required next work

1. Ship the CLI sample demo contract, including sample files, `notes-preflight demo` or `--demo`, a real terminal recording, `/demo`, the persistent sample label, reset, “Start for real,” and `.factory/demo.md`.
2. Publish through the factory-owned release process or replace the broken public install instruction with a working artifact path.
3. Register/fix the checkout and implement or remove every paid feature claim.
4. Add `.factory/claims.json` and one tagged sandbox test for every retained claim.
5. Fix the invalid state label, 404 response/page, metadata, site skeleton, plain words, copy audit, and touch targets.
