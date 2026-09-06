# Notes Import Preflight

Notes Import Preflight is for people moving years of notes between apps. The local CLI counts notes and attachments before an import, flags conversion risks, and compares a destination export for loss.

## Install

Install Rust 1.82 or newer. Then install the public source:

```sh
cargo install --git https://github.com/B-Divyesh/sf-notes-import-preflight.git --locked
```

The factory publishes registry packages and release binaries separately. This repository does not claim an unpublished crates.io package.

## Try the bundled sample

Run a complete scan and comparison without preparing files:

```sh
notes-preflight demo
```

The command copies the bundled five-note sample into a new temporary directory. It finds one changed note and one missing audio attachment, writes two JSON reports, and prints their location. Nothing outside that directory is changed.

The browser sample is at [notes-import-preflight.sociobot.in/demo/](https://notes-import-preflight.sociobot.in/demo/). It uses only bundled data in memory and does not read saved licenses or baselines.

## Scan and compare

Scan a directory or ZIP archive:

```sh
notes-preflight scan ./my-export
notes-preflight scan ./my-export.zip --json > before.json
```

After importing a copy, export the destination and compare it:

```sh
notes-preflight compare ./before.json ./destination-export
notes-preflight compare ./before.json ./destination-export --json --fail-on-loss
```

The CLI returns 0 after a completed command, 1 for invalid input, and 2 when `--fail-on-loss` finds loss. Its JSON uses schema 2 and can read schema 1 reports.

The scanner recognizes Markdown, HTML, text, RTF, ENEX, and JSON note files. It reports note and attachment counts, attachment bytes and types, link targets, metadata coverage, and sampled conversion risks. Comparisons find missing or changed notes and missing attachments. Duplicate names are matched by content fingerprint and occurrence count.

ZIP entries are streamed without extraction. Entry counts, per-entry bytes, total bytes, paths, and suspicious compression ratios are bounded. Proprietary databases are reported as unsupported; the tool does not access accounts or bypass encryption.

Saved reports contain aggregate diagnostics, normalized names, sizes, paths, and SHA-256 fingerprints. They do not contain note bodies or attachment bytes.

## Preflight Plus

The free CLI and browser folder check remain complete. Preflight Plus costs $19 once and is not a subscription. A valid license adds browser comparison, one locally saved baseline, printable audit sheets, and 30 days of setup help.

Sociobot/Dodo handles checkout and refunds. The site sends only the license token for verification, at most once per day after a successful check. Source files remain on the device.

## Develop and verify

Use Node.js 22 or newer and Rust 1.82 or newer from a clean checkout:

```sh
npm ci
npm test
npm run typecheck
npm run build
cargo package -p notes-preflight --allow-dirty
```

`npm test` runs unit, integration, browser, accessibility, privacy, offline, recovery, and public-claim checks. `npm run build` creates the static site in `dist/site/` and the CLI in `dist/bin/`.

The registry publish step belongs to the factory operator. To verify the packaged source locally, run `cargo package -p notes-preflight --allow-dirty` and install the resulting crate into a temporary Cargo root.

## Privacy

The CLI reads source paths without modifying them. The site has no analytics, advertising cookies, tracking pixels, or third-party scripts. Browser inspection does not upload archive names, contents, or results. See the public [privacy policy](https://notes-import-preflight.sociobot.in/privacy/).

## License

MIT. See [LICENSE](LICENSE).
