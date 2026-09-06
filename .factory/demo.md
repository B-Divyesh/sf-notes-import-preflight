# Demo contract

## Browser

- URL: `https://notes-import-preflight.sociobot.in/demo/`
- Entry: select **Try it with sample data** on the first screen.
- Sample: five notes in three notebooks, plus an image, audio file, and PDF. The data includes tasks, a table, code, links, metadata, and a wiki link.
- Expected output: 3 notebooks, 5 notes, 3 attachments, 78 bytes, and five conversion-risk groups. The sample comparison calls out one changed note and one missing audio file.
- Reset: **Reset demo** rebuilds the sample from bundled constants.
- Exit: **Start for real** returns to `/` and discards the in-memory sample.
- Isolation: demo state exists only in JavaScript memory. While the demo banner is present, the site does not read or write licenses, baselines, local storage, session storage, IndexedDB, or user-selected files.

## CLI

- Command: `notes-preflight demo`
- JSON command: `notes-preflight demo --json`
- Source: `crates/preflight/examples/sample-export/`, compiled into the binary.
- Isolation: every run creates a uniquely named `notes-preflight-demo-*` directory below the operating system temporary directory. It reads and writes only inside that new directory.
- Output: source and destination sample folders, `source-report.json`, and `comparison-report.json`. The path is printed so the user can inspect or remove it.
