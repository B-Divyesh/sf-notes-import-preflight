# Notes Import Preflight — repair 2 handoff

## Release status

The free CLI, browser folder check, one-click sample, paid feature implementation, site routes, and all declared claims are ready. The live release matches the built candidate.

One external dependency remains: the Sociobot billing product is not registered. Its checkout endpoint returned HTTP 404 after the final deployment. The page now keeps the visitor on the product and reports that registration is pending. Existing license restore and verification remain available. Exact registration metadata is in `/work/.evidence/billing-offer.json` for the separate billing operator.

- Live URL: https://notes-import-preflight.sociobot.in/
- Implementation SHA: `46ce1526d85e00355c6347614019cca9fef4d765`
- Claim-contract SHA: `009fe2606287c815e1a49be3648b839b511a469b`
- Handoff/report commit: the commit containing this file; it follows the implementation SHA above.
- Version: `0.2.0`
- Live/fresh `index.html` SHA-256: `059e0f48480d7298d0d334ed5c20ba623417077399597e10c66613679dcc327d`

## What changed

- Added `notes-preflight demo` and `notes-preflight demo --json`. Each run copies a realistic five-note sample into a unique temporary directory, scans it, compares a changed destination, saves two reports, and prints the location.
- Added `/demo/` with a first-screen populated result, the persistent “Demo — sample data, nothing is saved” label, reset, and start-real actions. Demo mode uses memory only and does not read or write real browser state.
- Replaced the unpublished crates.io command with a working public Git install command. A fresh Cargo home installed version 0.2.0 and ran its bundled demo.
- Implemented the advertised Plus paths: browser comparison, save/load/delete for one aggregate baseline, printable audit sheets, support email, restore, cached verification, and invalid-license locking.
- Added a graceful pending-registration message when the external checkout returns 404. The link will redirect normally when the billing product is registered.
- Fixed invalid browser input being overwritten as “Complete.” Recovery with a later valid folder is covered.
- Added a designed 404 page. Live unknown paths and `/404.html` return HTTP 404 with the product page body.
- Added route titles, canonical links, Open Graph/Twitter metadata, a 1200×630 image, apple-touch icon, consistent header/footer, version/build label, explicit external-link wording, sitemap routes, and security/cache rules.
- Replaced metaphorical public headings with plain task language. The first phone and desktop screen now states the job, audience, sample action, local-file fact, offline fact, and exact price.
- Brought all visible controls to 44 CSS pixels or larger and retained the designed 3 px focus ring.
- Added `.factory/claims.json` with 20 claims and exactly one matching outcome test per claim. Added `.factory/demo.md`, `.factory/copy-audit.md`, and the catalog description.

## Review 1 disposition

| Finding | Disposition |
|---|---|
| F-01 sample demo missing | Fixed in CLI and `/demo/`; sample, label, reset, start-real, storage isolation, and populated loss output pass. |
| F-02 public install broken | Fixed with public Git install; clean consumer installed 0.2.0 and ran `demo`. |
| F-03 checkout and paid claims | Paid features are implemented and tested. Checkout registration remains external; 404 is handled in-page and billing metadata is supplied. |
| F-04 claims missing | Fixed: 20 declared claims, 20 unique tags, every command passed individually and together. |
| F-05 invalid folder says Complete | Fixed; invalid stays “Needs attention,” then a valid selection recovers. |
| F-06 no real 404 | Fixed live: unknown paths and `/404.html` return 404 with the designed page. |
| F-07 metadata and structure | Fixed across home, demo, privacy, terms, and 404 pages. |
| F-08 metaphorical words and no audit | Fixed; `.factory/copy-audit.md` has no sentence over 22 words or banned term. |
| F-09 narrow targets | Fixed and measured at 390 px. |

The earlier collision, immutable cache, CSP, and Lighthouse findings remain resolved.

## Verification

Clean setup and full gates:

```sh
npm ci
npm test
npm run typecheck
npm run build
cargo package -p notes-preflight --allow-dirty
```

Results:

- `npm test`: 3 Vitest tests, 6 Rust unit tests, 1 Rust integration test, Rust doc tests, 20 claim tests, and 12 site/browser tests passed.
- Every command in `.factory/claims.json` passed independently. Log: `/work/.evidence/claim-commands.log`.
- `npm run typecheck` and `npm run build` passed. Output exists at `dist/site/` and `dist/bin/notes-preflight`.
- `cargo package`: packaged and independently verified `notes-preflight-0.2.0.crate` with its bundled sample.
- Clean packed-crate consumer: installed 0.2.0, then reported 3 notebooks, 5 notes, 3 attachments, one changed note, and one missing audio file.
- Browser checks: normal, empty/invalid, recovery, demo/reset/exit, JSON download, destination loss/pass, saved baseline, delete confirmation, print, valid/invalid license, daily cache, pending checkout, 404, keyboard, focus, 200% text, and reduced motion passed.
- Axe Playwright integration: 0 serious or critical findings at 1440×900 and 390×844.
- Live `verify-url.sh`: passed with no load console errors, one `h1`, `lang=en`, `main`, alt text, and labeled buttons.
- Live cold phone and desktop: no horizontal overflow or console errors. The job, audience, and first actions are visible without scrolling.
- Live demo phone: the full sample result fits in the 390×844 first screen. Reset restored 3 notebooks, 5 notes, and 3 attachments. Storage stayed empty; all demo requests were same-origin; start-real returned to `/`.
- Live real-folder check: 3 notebooks, 5 notes, and 3 attachments; the selected source hash stayed unchanged.
- Live offline demo: service-worker-controlled reload retained the populated five-note sample.
- Live 404: `/does-not-exist` and `/404.html` both returned HTTP 404 with the designed page.
- Live Lighthouse mobile: performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.4 s, CLS 0, total blocking time 0 ms.
- Initial production assets: main JS 13,166 B, CSS 19,921 B, fonts 57,020 B total, phone hero 22,084 B.
- Live headers retain CSP, HSTS, `nosniff`, strict referrer policy, frame denial, revalidated HTML/service worker, and immutable hashed assets.

## Remaining operator step

Register the one-time billing offer from `/work/.evidence/billing-offer.json`, then confirm the checkout redirects to hosted payment and a real returned license verifies. Do not infer entitlement from the redirect alone. No product code, price, or paid deliverable should change for registration.
