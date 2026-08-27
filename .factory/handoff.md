# Notes Import Preflight — v0.1.0 handoff

## Shipped

- A typed Rust single-binary CLI with `scan` and `compare` commands, human and versioned JSON output, useful `--help`, bounded scan limits, and CI-friendly exit codes (`0` success, `1` invalid/unsafe input, `2` loss with `--fail-on-loss`).
- Read-only directory, ZIP, ENEX, Markdown, HTML, text, RTF, and common JSON export inventory. It reports notebook/note counts, attachments and sizes/types, link categories and unresolved targets, metadata coverage, and sampled conversion risks.
- Source-to-destination comparison by normalized note title plus attachment content fingerprint (or name/size fallback). The committed fixture identifies 100% of its intentionally missing attachments.
- Untrusted-archive defenses: no extraction, normalized/enclosed paths only, symlink skipping, entry/file count limits, bounded streaming reads, total expanded-size limits, compression-ratio rejection, and honest handling of encrypted/proprietary sources.
- A static Vite landing/docs site with a functional browser-only folder inventory, JSON report export, explicit empty/loading/error/offline states, responsive 390 px layout, keyboard focus treatment, and a Plus destination comparison workspace.
- One-time $19 Preflight Plus purchase and restore flow following the Sociobot contract: hosted checkout, query-token capture, local storage, daily-cached verification, optimistic cached unlock, background reconciliation, quiet invalid-license handling, and pilot API use on localhost.
- `/privacy/` and `/terms/`, no analytics or third-party runtime scripts, a versioned offline shell service worker, self-hosted 57 KB Latin font subsets, robots/sitemap metadata, and an MIT license.
- A product-specific night-market inspection visual system plus an original generated hero. The final prompt and factory deployment metadata are stored in `.factory/design.md` and `site/public/assets/preflight-market.png.json`; responsive WebP outputs are 22 KB, 46 KB, and 83 KB.

## Run and verify

```sh
npm install
npm test
npm run build
dist/bin/notes-preflight --help
dist/bin/notes-preflight scan tests/fixtures/source
dist/bin/notes-preflight compare tests/fixtures/source tests/fixtures/destination --fail-on-loss
cargo package -p notes-preflight --allow-dirty
```

`npm run build` is the factory build command. It emits `dist/site/index.html` (deploy root) and `dist/bin/notes-preflight`. The publish-ready crate is created with `cargo package -p notes-preflight`; registry credentials were not used.

## Verification completed

- `npm test`: 2 browser inventory tests and 4 Rust tests pass.
- Fixture E2E: browser reports 1 notebook, 1 note, 1 attachment and the task risk; packaged CLI reports the missing `receipt.jpg` and returns exit code 2.
- Production preview smoke test (`verify-url.sh`): HTTP 200, one h1, `lang`, main landmark, alt text present, zero unlabeled buttons, and zero console errors.
- Axe Core 4.13 WCAG 2/2.1 A/AA scan at 390×844: zero violations.
- Lighthouse mobile on the production build: **Performance 99, Accessibility 100, Best Practices 100, SEO 100**; FCP 1.4 s, LCP 1.7 s, CLS 0, total blocking time 0 ms, speed index 1.4 s.
- Static budgets: initial JS 8.03 KB, CSS 15.21 KB, fonts 56 KB, selected mobile hero 46 KB or less; all are below contract budgets.
- Desktop and 390 px full-page screenshots were reviewed in `.factory/evidence-final/` during the build (local evidence is intentionally gitignored).

## Known gaps and next steps

- Proprietary Apple Notes databases, OneNote `.one`, and encrypted archives are intentionally not decoded. Users must export through the source application first.
- The browser tool is a fast unzipped-folder spot check and matches attachments by name/size. The free CLI is authoritative because it scans ZIP/ENEX and uses SHA-256 content fingerprints.
- The factory still needs to register the billing product and switch/confirm the hosted checkout configuration at release. Localhost verification deliberately uses `pilot-api.sociobot.in`; the deployed Sociobot hostname uses production `api.sociobot.in`.
- Release binaries should be built for each supported OS and attached by the factory release pipeline. No package or binary was published from this worker.
