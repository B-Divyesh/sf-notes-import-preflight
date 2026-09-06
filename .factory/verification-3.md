# Check notes exports before migration — verification 3

## Verdict: FAIL

This review has **1 finding** and **1 untested public claim**. It cannot declare PASS.

- Live URL: https://notes-import-preflight.sociobot.in/
- Implementation reviewed: `46ce1526d85e00355c6347614019cca9fef4d765`
- Documentation reviewed: `3c11150d9d79967515aa3bb2b6f4b2cb43ca4718`
- Clean checkout: `3c11150d9d79967515aa3bb2b6f4b2cb43ca4718`
- Verified: 2026-09-06 UTC
- Live and fresh-build `index.html` SHA-256: `059e0f48480d7298d0d334ed5c20ba623417077399597e10c66613679dcc327d`

Only `.factory/handoff.md` changed after the implementation candidate. The exact live HTML hash equals the fresh build, so the deployed product is the reviewed implementation.

## First screen

Fresh 1440×900 desktop and 390×844 phone browsers showed the required content before scrolling.

- **Job:** “Check a notes export before you migrate.”
- **Audience:** “For people moving years of notes, it counts the source and finds losses after import.”
- **First action:** “Try it with sample data.” The action was visible at both sizes and opens the realistic five-note sample.

Both views had one `h1`, one `main`, no horizontal overflow, and no console errors. Evidence: `/work/.evidence/verification-3-desktop-landing.png` and `/work/.evidence/verification-3-phone-landing.png`.

## Finding

### F-01 — P1 — The promised 30 days of setup help is not a declared, tested claim

The landing page, Terms, and README state that Preflight Plus includes “30 days of setup help”; the live Plus workspace says to email support “within 30 days of purchase.” The only nearby contract record is `plus-features`, whose wording is only “a setup-support path.” Its test proves a `mailto:` link exists, but it does not assert the 30-day amount, the start of that period, or a way to provide that entitlement.

This is a public quantitative purchase promise. The claims contract requires it to be declared and tested with its number. It is not, so it is an untested claim and a release finding. The test command itself passes; that does not prove the omitted quantitative promise.

Required repair: either remove the 30-day promise everywhere, or add a claim that names the 30-day period and an observable, sandboxed entitlement path that proves it. Re-run the claim contract after that change.

## Declared claims

All 20 commands declared in `.factory/claims.json` were run independently from the clean checkout and passed. The complete command log is `/work/.evidence/verification-3-claim-commands.log`.

| Claim ID | Result |
|---|---|
| `demo-sandbox` | PASS |
| `install-git` | PASS |
| `cli-read-only` | PASS |
| `browser-private` | PASS |
| `no-tracking` | PASS |
| `inventory-counts` | PASS |
| `risk-link-metadata` | PASS |
| `directory-zip` | PASS |
| `supported-formats` | PASS |
| `archive-bounds` | PASS |
| `schema-compat` | PASS |
| `report-redaction` | PASS |
| `loss-comparison` | PASS |
| `collision-safe` | PASS |
| `exit-codes` | PASS |
| `unsupported-database` | PASS |
| `offline-reload` | PASS |
| `plus-price` | PASS |
| `plus-features` | PASS for its stated setup-link scope; does not cover 30 days |
| `license-verification` | PASS |

Untested public claims: **1** (`30 days of setup help`).

## Clean checkout and installed artifact

From a new clone at `3c11150`:

```sh
npm ci
npm test
npm run typecheck
npm run build
cargo package -p notes-preflight --allow-dirty
```

All commands passed. `npm test` passed 3 Vitest tests, 6 Rust unit tests, 1 Rust integration test, Rust doc tests, 20 claim tests, and 12 browser/site tests (32 browser tests total).

The packaged `notes-preflight-0.2.0.crate` was extracted and installed into a separate Cargo home and consumer root. Its `--version` reported `0.2.0`; `demo --json` reported 3 notebooks, 5 notes, 3 attachments, one changed note, one missing `interview.m4a`, and `loss-detected`.

## Live checks

- `/`, `/demo/`, `/privacy/`, and `/terms/` returned 200 with route-specific titles, `lang=en`, one `h1`, one `main`, and no console errors.
- The demo entered directly at `/demo/`, showed “Demo — sample data, nothing is saved,” 3 notebooks, 5 notes, 3 attachments, and the sample loss. Reset restored the same result. Demo storage stayed empty, requests stayed same-origin, and Start for real returned to `/`.
- The normal browser folder scan counted the shipped source fixture as 3 notebooks, 5 notes, and 3 attachments without changing its hash. Invalid input stayed “Needs attention”; a subsequent valid selection recovered to “Complete.”
- A service-worker-controlled fresh demo reloaded offline with the five-note result. Reduced motion set the hero animation to `1e-05s`; 200% text had no horizontal overflow.
- Keyboard focus started on the skip link with a 3 px focus outline. Playwright axe found zero serious or critical violations at 1440×900 and 390×844.
- The factory `verify-url.sh` passed: title present, `lang=en`, one `h1`, `main`, image alt text, labeled buttons, and no load console errors. Evidence: `/work/.evidence/verification-3-verify-url.eb8mlP/verify.json`.
- All internal landing-page links returned 200. `/does-not-exist` returned the designed page with HTTP 404. This deliberate 404 is correct.
- Live headers include CSP with `frame-ancestors 'none'`, HSTS, `nosniff`, strict referrer policy, permissions policy, and frame denial. Hashed assets are immutable cached; HTML revalidates.
- The operator-owned billing checkout returned the expected HTTP 404 body. The page stayed on the product and reported that registration is pending. This is an expected external dependency, not counted as a product defect.

Lighthouse 12.8.2 was attempted with the supplied Playwright Chromium. The browser tab crashed while Lighthouse captured its final screenshot, so it produced no valid independent scores. This is an environment measurement limit, not a substituted product pass; the functional performance budgets and browser checks above passed.

The product is static and local-first. Tenant isolation, SQLite restart persistence, product health endpoints, and product 429/`Retry-After` behavior do not apply. The external billing service is outside this product scope.

## Earlier findings

| Earlier finding | Current disposition |
|---|---|
| F-01 missing sample demo | Fixed and rechecked: CLI demo and `/demo/` use bundled data, show the persistent label, reset, exit, and populated loss output. |
| F-02 broken public install | Fixed and rechecked: the documented public Git install completed from a fresh Cargo home. |
| F-03 checkout and paid paths | Checkout registration remains operator-owned and deliberately reports pending in-page. Browser comparison, baseline, printing, restore, and support email paths are present. The separate 30-day support promise is F-01 above. |
| F-04 missing claim contract | Fixed for 20 declared claims; each command passed independently. One additional public claim is still unlisted and untested (F-01). |
| F-05 invalid input said Complete | Fixed and rechecked: invalid input says Needs attention, then a valid selection recovers. |
| F-06 no real 404 | Fixed and rechecked: unknown paths return designed HTTP 404. |
| F-07 metadata and shared structure | Fixed and rechecked across home, demo, legal pages, footer, titles, canonical links, and internal links. |
| F-08 unclear and metaphorical copy | Fixed and rechecked on the first screen and copy audit. |
| F-09 undersized touch targets | Fixed and rechecked at 390 px. |
| Duplicate-name/equal-size comparison collision | Fixed and rechecked by the collision claim and installed artifact behavior. |
| Immutable asset cache and CSP | Fixed and rechecked in live response headers. |
| Lighthouse could not run in an earlier environment | Reattempted here; this environment again crashed Lighthouse before a valid report. It is recorded accurately rather than treated as a score. |

## Result

**FAIL — do not mark this candidate as PASS until the 30-day setup-help promise is removed or fully declared and tested.**
