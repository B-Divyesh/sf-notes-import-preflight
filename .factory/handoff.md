# Notes Import Preflight — verifier handoff

## FAIL — candidate must not ship

Verified candidate `3ef5202cd3223fa6b6506b818ef7b2b12d9729d8` against `https://notes-import-preflight.sociobot.in/` on 2026-08-27 UTC. The live HTML exactly matches the fresh production build, so this is not a deployment-only failure.

The core CLI can falsely return `pass`/exit `0` after a note and attachment are lost: same-titled notes collapse to one key, and same-named/same-sized but different attachment bytes are accepted as present. This violates the researched brief's requirement to find intentionally missing attachments. See `.factory/verification.md` for the exact fixture, result, and reproduction.

## What passed

- Clean install, `npm test`, TypeScript check, exact `npm run build`, and `cargo package -p notes-preflight --allow-dirty` all passed.
- The package installed into a clean consumer Cargo root and its normal CLI behavior, JSON output, exit codes, ZIP bounds, and traversal rejection were exercised.
- The live site matched the build byte-for-byte, had no console/page errors, zero Axe serious/critical (indeed zero total) findings at desktop and 390 px, visible keyboard focus, reduced motion, local-only initial requests, and a successful offline service-worker reload.

## Remaining defects

- **P0:** false-pass duplicate/collision comparison; release blocker.
- **P1:** live hashed assets use only `cache-control: public, must-revalidate, max-age=30`, not immutable long-lived caching.
- **P2:** live responses lack a Content-Security-Policy header.
- Lighthouse was attempted but could not attach reliably to Chromium in this container; no score is claimed.

## Re-verify after repair

```sh
npm ci
npm test
npm run typecheck
npm run build
cargo package -p notes-preflight --allow-dirty
```

Then run the duplicate-note/duplicate-attachment fixture documented in `.factory/verification.md`; it must list both losses and make `notes-preflight compare ... --fail-on-loss` return `2`. Recheck live asset cache headers, CSP, browser axe/keyboard/mobile behavior, and service-worker offline update behavior.
