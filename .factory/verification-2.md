# Independent verification — PASS

**Candidate:** `06aa37a57054c99e8bef280b397898b26bdebbcc`  
**Live URL:** https://notes-import-preflight.sociobot.in/  
**Verified:** 2026-08-28 UTC  
**Verdict:** **PASS — candidate is suitable for release.**

This is a fresh independent verification. The checkout started clean at the candidate commit; product source was not changed.

## Build, tests, and published artifact

- `npm ci` completed: 57 packages installed; npm audit reported 0 vulnerabilities.
- `npm test` passed: 3 Vitest tests, 6 Rust unit tests, 1 Rust CLI integration test, and Rust doc tests (0 defined).
- `npm run typecheck` passed.
- Exact production command `npm run build` passed and produced `dist/site/` and `dist/bin/notes-preflight`.
- `cargo package -p notes-preflight --allow-dirty` passed. Cargo independently verified the packed `notes-preflight-0.1.1.crate`.
- Clean-consumer test passed: extracted that `.crate` to a new `/tmp` root, installed it with `cargo install --path ... --root ... --debug`, then ran `notes-preflight 0.1.1` and `scan`. It reported schema 2, 1 notebook, 1 note, 2 attachments, and the expected table/task/wiki-link risks.

## CLI acceptance tests

Using independently-created temporary fixtures and the built binary:

- A normal Markdown export with metadata, task, table, wiki link, external link, and JPEG attachment scanned successfully. It reported 1 notebook, 1 note, 1 attachment, the expected risks and external link. The JSON includes the allowed normalized note title but did not include tested body text, metadata values, or attachment bytes.
- Comparing it with a changed note and missing attachment produced `loss-detected` and `--fail-on-loss` exited **2**.
- The previous collision case was independently reproduced: two same-titled notes and two same-named, equal-size but different-byte attachments versus a one-note/one-attachment destination produced missing `Same [A/note.md]` and `receipt.jpg [B/receipt.jpg]`, verdict `loss-detected`, exit **2**.
- An equivalent ZIP scanned successfully. Invalid/missing input and a zero limit returned actionable errors with exit **1**. A 2 MiB member failed at `--max-entry-mb 1`; the archive also failed at `--max-total-mb 1`; a ZIP entry renamed to `../evil.md` was rejected with `unsafe ZIP path rejected`.

These results satisfy the brief's primary success criterion: intentionally missing attachments are detected before migration, including duplicate-name and same-size collision cases.

## Live deployment, privacy, and browser QA

- Live `/` SHA-256 is `e4e7fda13f26c9d1d44189e0be6958ad7a9efe804d5c395dfed00fd7f49a03b8`, exactly equal to the fresh `dist/site/index.html`; the deployment matches this candidate.
- The live initial page requested only the product origin. No analytics, upload, third-party script/font, or archive-data request was observed. The source and runtime only identify the documented opt-in Sociobot license verification endpoint, used after a license is stored.
- At 1440 px and 390 px: no page or console errors, one `h1`, `lang=en`, title, `main`, and meaningful hero alt text. Mobile `scrollWidth` was 390; responsive 640 px (mobile) and 960 px (desktop) hero assets were selected. Keyboard first focus was the skip link with a visible `rgb(255, 191, 71)` 3 px outline.
- Folder-demo exercise passed: choosing a destination first gives “Scan the source folder above first.”; choosing a source completes its manifest; then a destination comparison reports loss without console errors. The browser test operates entirely on selected local files.
- `prefers-reduced-motion: reduce` matched and yielded 0.00001 s animation and transition durations. Injected axe-core 4.10.3 (with CSP bypass only for the audit) reported **0 violations**, including **0 serious/critical**, at both 1440 px and 390 px. The standalone axe CLI could not start Chrome in this container; the Playwright axe audit was used instead.
- Service worker behavior passed: registration was ready and controlling the live page after reload; an offline reload retained the application title, h1, and controller without errors. `sw.js` has versioned cache `notes-preflight-v2`, `skipWaiting`, old-cache cleanup, and `clients.claim`.

## Headers and budgets

- Live HTML and `/sw.js`: `Cache-Control: public, max-age=0, must-revalidate`. Hashed JS: `public, max-age=31536000, immutable`. HSTS, `nosniff`, strict referrer policy, frame denial, permissions policy, and the configured restrictive CSP were present.
- Fresh build: app JS 9,013 B (Vite: 9.01 kB / 3.99 kB gzip); CSS 15.24 kB / 4.51 kB gzip; self-hosted fonts total 57,020 B; 390 px hero is 22,084 B. All stated size budgets pass.
- Lighthouse was attempted with Lighthouse 12.8.2 and the supplied Chromium (`CHROME_PATH` and `--no-sandbox`); Chromium's tab crashed before a report could be generated. This is an environment measurement limitation, not a substituted score. Functional performance budgets and browser checks above passed.

## Defects by severity

- **P0:** none.
- **P1:** none.
- **P2/P3:** none found.
