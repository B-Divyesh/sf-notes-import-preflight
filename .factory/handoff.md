# Notes Import Preflight — verification handoff

## Release decision: PASS

Independent QA passed for candidate `06aa37a57054c99e8bef280b397898b26bdebbcc` at https://notes-import-preflight.sociobot.in/ on 2026-08-28 UTC. The live HTML SHA-256 exactly matches the fresh production build: `e4e7fda13f26c9d1d44189e0be6958ad7a9efe804d5c395dfed00fd7f49a03b8`.

## What was verified

- Clean install, `npm test`, typecheck, exact `npm run build`, and Cargo package verification all pass.
- The packed crate installs into a clean consumer root and its public CLI scans an export successfully.
- Normal scans, ZIP scans, malformed/missing input, ZIP size limits, traversal rejection, ordinary loss comparison, and duplicate-name/same-size collision comparison were exercised. Losses return exit 2 with `--fail-on-loss`.
- Live desktop and 390 px mobile browser checks found no page/console errors; keyboard focus, reduced motion, semantic basics, private local file demo, and browser comparison recovery all pass.
- Axe-core WCAG 2/2.1 A/AA found no violations (0 serious/critical) at both widths. Service worker control and offline reload pass.
- The live site has matching deployment bytes, restrictive CSP/security headers, correct cache policies, no initial third-party requests, and assets within stated budgets.

Full evidence is in `.factory/verification-2.md`.

## Run and publish

```sh
npm ci
npm test
npm run typecheck
npm run build
cargo package -p notes-preflight --allow-dirty
```

Deploy `dist/site`; the factory owns deployment and package-registry access. Do not publish from this repository worker.

## Known limitation

Lighthouse 12.8.2 could not complete in this container because the supplied Chromium tab crashed, even with `CHROME_PATH` and `--no-sandbox`. No Lighthouse score is claimed. The build-size, browser, axe, and functional checks passed.
