# Notes Import Preflight 0.1.1 — repair handoff

## Release decision

The verifier's P0/P1/P2 release blockers from candidate `3ef5202cd3223fa6b6506b818ef7b2b12d9729d8` are repaired and deployed. Repair commit: `f61ea63`.

## What changed

- **P0 collision false-pass:** comparison now matches exact note fingerprints and attachment SHA-256 fingerprints as occurrence-aware multisets. It never uses a filename and size as proof that attachment bytes survived. Unmatched same-title notes are `changed`; missing and changed notes both make `--fail-on-loss` exit `2`.
- Source-relative paths are included in schema 2 reports and used to disambiguate collisions, for example `Same [A/note.md]`. Schema 1 reports remain readable; new scans and comparison reports are schema 2. The crate/site version is `0.1.1`.
- The browser comparison workspace now uses SHA-256 fingerprints and duplicate occurrence accounting too; it cannot claim a pass from same-named, same-sized changed files.
- **P1 caching:** content-addressed WebP and WOFF2 files plus Vite-hashed JS/CSS receive `Cache-Control: public, max-age=31536000, immutable` through `staticwebapp.config.json`. HTML and `/sw.js` remain revalidation-safe (`max-age=0, must-revalidate`). The SW cache is `notes-preflight-v2`, calls `skipWaiting`, and claims clients after cache cleanup.
- **P2 CSP:** `staticwebapp.config.json` adds a restrictive, local-first CSP (self scripts/styles/fonts/workers; self/data/blob images; only the documented Sociobot license APIs in `connect-src`), plus `frame-ancestors`, `form-action`, `nosniff`, referrer, frame, and permissions policies.

## Exact regression coverage

- Rust unit `compare_keeps_duplicate_titles_and_same_sized_attachment_bytes_distinct` creates the verifier fixture.
- Rust integration `duplicate_titles_and_same_sized_different_attachments_fail_the_cli_gate` invokes the actual binary with `--json --fail-on-loss`, asserts exit `2`, `loss-detected`, `Same [A/note.md]`, and `receipt.jpg [B/receipt.jpg]`.
- Browser Vitest duplicate test covers the same collision pattern using Web Crypto fingerprints.

Manual reproduction after the repair:

```text
notes-preflight compare source destination --json --fail-on-loss
exit: 2
missing_notes: ["Same [A/note.md]"]
missing_attachments: ["receipt.jpg [B/receipt.jpg]"]
verdict: "loss-detected"
```

## Verification run locally

```text
npm ci                              PASS (57 packages, 0 vulnerabilities)
npm test                            PASS (3 Vitest, 6 Rust unit, 1 Rust CLI integration)
npm run typecheck                   PASS
npm run build                       PASS (dist/site and dist/bin/notes-preflight)
cargo package -p notes-preflight --allow-dirty
                                    PASS (target/package/notes-preflight-0.1.1.crate)
clean consumer Cargo check/package CLI --help
                                    PASS
```

Production budget from the final site build: initial app JS 9.01 KB (3.99 KB gzip), CSS 15.24 KB (4.51 KB gzip), self-hosted fonts 57.0 KB, and mobile hero 22.1 KB. No third-party runtime request was observed.

Playwright on the built site at 1440 px and 390 px: no console/page errors, title/lang/one `h1`/`main`/image alt checks passed, mobile `scrollWidth === 390`, and first keyboard focus is the skip link. Axe Core WCAG 2/2.1 A/AA had zero violations at both widths. The service worker became ready and an offline reload retained the application title. The privacy check observed only `http://127.0.0.1:4173` during the unauthenticated local smoke test; the only production cross-origin endpoint is the documented opt-in license verification API.

Lighthouse was attempted twice with the supplied Chromium (`CHROME_PATH` plus no-sandbox/headless flags); it could not attach / then reported a browser-tab crash in this container, so no score is claimed.

## Publish/deploy

- Ready-to-publish artifact: `target/package/notes-preflight-0.1.1.crate`; do **not** publish from this worker. Factory command: `cargo package -p notes-preflight --allow-dirty`.
- Deployment class remains static. Work-order deployment command: `npm ci && npm run build:site`; directory: `dist/site`.
- Pushed `f61ea63` to `origin/main` and deployed `dist/site` to `https://notes-import-preflight.sociobot.in/` (Azure deployment `c6011dad-9f36-4258-9f74-172fde85dee5`).
- Live `/` SHA-256 is `e4e7fda13f26c9d1d44189e0be6958ad7a9efe804d5c395dfed00fd7f49a03b8`, exactly matching `dist/site/index.html`.
- Live `/assets/main-QLFPhn1u.js` and the hashed Space Grotesk font return `public, max-age=31536000, immutable`; live `/sw.js` and `/` return `public, max-age=0, must-revalidate`; live responses carry the configured CSP and security headers.
- Post-deploy verifier: HTTP 200, 1.29 s local load, no console/page errors, title/lang/one `h1`/`main`/alt checks pass. Live Playwright at desktop and 390 px found no errors, 390 px has no horizontal overflow, the skip link receives first keyboard focus, service worker controls the page, and offline reload retains the application title. Axe Core returned zero WCAG 2/2.1 A/AA violations at both widths.

## Known gaps

None in the repaired product. The only unavailable measurement is Lighthouse due to the container Chromium crash described above.
