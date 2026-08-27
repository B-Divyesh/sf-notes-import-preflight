# Independent verification — FAIL

**Candidate:** `3ef5202cd3223fa6b6506b818ef7b2b12d9729d8`  
**Live URL:** `https://notes-import-preflight.sociobot.in/`  
**Verified:** 2026-08-27 UTC  
**Verdict:** **FAIL — do not release this candidate.**

## Release blocker

### P0 — comparison can report a lost note and attachment as a pass

The core compare operation keys notes by normalized title and treats an attachment with the same normalized filename and byte count as present even when its SHA-256 fingerprint is different. This produces a false pass when two notebooks contain same-titled notes and same-named/same-sized attachments.

Fresh reproduction with the packaged production binary:

```text
source/A/receipt.jpg = "aaa"       source/A/note.md = "# Same\nAlpha"
source/B/receipt.jpg = "bbb"       source/B/note.md = "# Same\nBravo"
destination/C/receipt.jpg = "aaa"  destination/C/note.md = "# Same\nBravo"

notes-preflight compare source destination --json --fail-on-loss
exit: 0
```

Actual result:

```json
{
  "source": { "notebooks": 2, "notes": 2, "attachments": 2, "attachment_bytes": 6 },
  "destination": { "notebooks": 1, "notes": 1, "attachments": 1, "attachment_bytes": 3 },
  "missing_notes": [],
  "changed_notes": ["Same"],
  "missing_attachments": [],
  "verdict": "pass"
}
```

One attachment and one note are absent, but `--fail-on-loss` returns success. This violates the brief's success measure (find 100% of intentionally missing attachments) and makes the CLI unsafe as a migration gate.

## Quality gates run from the clean candidate checkout

- `npm ci` — PASS; 57 packages installed, 0 vulnerabilities reported.
- `npm test` — PASS; 2 Vitest tests and 4 Rust unit tests passed.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; generated `dist/site/` and `dist/bin/notes-preflight`.
- `cargo package -p notes-preflight --allow-dirty` — PASS; produced `target/package/notes-preflight-0.1.0.crate` and Cargo's package verification build passed.
- Clean consumer check — PASS: installed the packaged source into a new `/tmp` Cargo root; its `notes-preflight 0.1.0` scanned the fixture correctly and returned exit `2` for the ordinary missing-attachment fixture.

## CLI and archive behavior exercised

- Normal source scan reported 1 notebook, 1 note, 1 JPEG attachment, metadata, links, and the task conversion risk. JSON did not contain note body text.
- Ordinary source-to-destination comparison reported `receipt.jpg` missing and returned `2` with `--fail-on-loss`; identical source/destination returned `0` and `pass`.
- Missing input and zero limits returned `1` with actionable errors.
- A ZIP scan succeeded. Boundary checks returned `1` for `--max-entries 1`, 2 MiB input under `--max-entry-mb 1`, and a ZIP exceeding `--max-total-mb 1`.
- A ZIP entry renamed to `../evil.md` was rejected with `unsafe ZIP path rejected: ../evil.md` and exit `1`.

## Live deployment, privacy, browser, and PWA evidence

- The deployed `/` body SHA-256 was exactly equal to the fresh production build: `ce392ca7470158f100b3ac6f5ecd42d919291bdba2ecfd47b7147d27b6062c82`. The deployment is therefore this candidate, not a stale/deployment-only failure.
- Desktop (1440 px) and 390 px mobile were visually reviewed. Mobile had no horizontal overflow (`scrollWidth === 390`); the 640 px responsive hero was selected at mobile and the 960 px asset at desktop.
- Keyboard smoke test reached the skip link, navigation, folder chooser, report export, command output, purchase link, and license input. Every sampled control showed the designed 3 px visible focus treatment.
- Browser folder scan of the supplied source fixture reported 1 notebook, 1 note, 1 attachment, and the task risk. Choosing a destination before a source showed “Scan the source folder above first.” No browser console or page errors occurred.
- Axe Core WCAG 2/2.1 A/AA: 0 violations at desktop and 390 px. Semantic checks passed: title, `lang=en`, one `h1`, `main`, skip link, and image alt text. `prefers-reduced-motion` matched and the reduced-motion stylesheet disables animation/transition duration.
- A first load made requests only to the product origin (HTML, local JS/CSS/image/font files); no analytics, archive upload, or third-party runtime request was observed. License verification is the documented opt-in Sociobot API call only after a license is stored.
- Service worker registered, controlled the page after reload, and an offline reload returned the application title without errors.
- Production asset budgets pass: initial JS 8.03 KB (3.65 KB gzip), CSS 15.21 KB (4.49 KB gzip), fonts 57.0 KB total, and mobile hero 22.1 KB. A Lighthouse run could not be completed in this container because Lighthouse could not attach to the supplied Chromium (then reported a browser-tab crash); this is recorded rather than substituting the builder's claim.

## Deployment defects found

### P1 — hashed static assets are not immutable cached

The live HTML, JS, CSS, fonts, and service worker all return `cache-control: public, must-revalidate, max-age=30`. Hashed JS/CSS/font assets should have a long-lived immutable policy under the performance contract. This unnecessarily forces revalidation and is not the requested deployment caching policy.

### P2 — no Content-Security-Policy response header

The live `/`, legal pages, service worker, JS, CSS, and fonts have HSTS, `nosniff`, and a referrer policy, but no `Content-Security-Policy`. A restrictive static-site CSP would materially reduce script-injection exposure, particularly because the page stores a license token in local storage.

## Required next steps

1. Redesign comparison identity to preserve enough source context (at least stable relative paths and duplicate occurrence accounting); use fingerprints as the authoritative attachment identity and treat changed/missing duplicate notes as loss for `--fail-on-loss`.
2. Add regression tests for the collision fixture above, including the required non-zero exit.
3. Configure deployment cache headers: immutable long-lived caching for hashed assets and an update-safe, short-lived service worker; add a restrictive CSP appropriate for the local-first site.
4. Re-run this verification, including the duplicate-loss fixture and browser/Lighthouse check, after a new candidate is deployed.
