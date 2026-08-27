# Notes Import Preflight

Notes Import Preflight is a local, read-only quality gate for people moving years of notes between apps. It inventories a directory or ZIP export before import, calls out fragile content, and compares a destination export to find missing notes and attachments. Archive contents never leave the machine.

## Install

Download a release binary, or build from source with Rust 1.82 or newer:

```sh
cargo install --path crates/preflight
```

## Usage

Inspect an export. Directories and `.zip` archives are supported; Apple Notes HTML/Markdown exports, Obsidian vaults, Joplin Markdown exports, generic HTML, text, and Evernote `.enex` files are recognized.

```sh
notes-preflight scan ./my-export
notes-preflight scan ./my-export.zip --json > before.json
```

After importing, export the destination and compare it with the source:

```sh
notes-preflight compare ./my-export.zip ./destination-export
notes-preflight compare ./before.json ./destination-export --json --fail-on-loss
```

`--fail-on-loss` exits with code 2 when notes or attachments appear to be missing, which makes it useful in scripts. Invalid input or an unsafe archive exits with code 1. `--max-entry-mb` and `--max-total-mb` lower or raise bounded ZIP scan limits; archives are streamed and never extracted.

The JSON schema is versioned with `schema_version`. Reports contain aggregate diagnostics, normalized names, sizes, and content fingerprints; note bodies and attachment bytes are never written to the report.

## What it checks

- notebook, note, attachment, and byte counts
- attachment types and unusually large files
- internal, local-file, external, and unresolved link targets
- metadata coverage for created/updated timestamps and tags
- conversion risks such as tables, tasks, wiki links, embeds, data URLs, math, code blocks, audio, and video
- missing or changed notes and attachments in a destination export

Encrypted or proprietary database exports are reported honestly as unsupported; this tool does not bypass encryption or access any notes account.

## Site and browser demo

The static documentation site includes a private browser-side file inventory demo and the paid Preflight Plus convenience tier. Browser files stay in the tab.

```sh
npm install
npm run dev
npm run build:site  # output: dist/site
```

## Develop and verify

```sh
cargo test --workspace
cargo run -p notes-preflight -- --help
cargo package -p notes-preflight --allow-dirty
npm test
npm run build
```

`npm run build` is the reproducible factory build command and produces the deployable site at `dist/site/index.html` plus a packaged CLI binary in `dist/bin/`.

## Privacy and security

There is no telemetry. CLI scans are local and read-only. The browser demo runs locally in the browser and does not upload file contents. ZIP paths, file counts, per-entry size, and total decompressed size are bounded before parsing. See the site’s privacy and terms pages for the optional license flow.

## License

MIT. See [LICENSE](LICENSE).
