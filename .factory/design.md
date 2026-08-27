# Visual thesis — night-market migration desk

Notes Import Preflight borrows the legibility and tension of a night-market inspection stall: private cargo arrives in sealed crates, a practiced operator checks every label beneath bright signage, and a stamped manifest says what may safely move on. The site is explicitly single-mode and dark; a light theme would dissolve the after-hours inspection metaphor.

## System

- **Palette:** `ink #080A0D` is the street-night background; `stall #11151A` and `steel #1B222A` are work surfaces; `paper #F4EFE4` is the primary text; `mist #B7C1C8` is muted copy; `signal #56F4C4` is mint inspection light; `amber #FFBF47` is caution; `danger #FF6B7A` is loss; `violet #C8A7FF` labels secondary information. Signal-on-ink and paper-on-ink exceed WCAG AA. Status is always paired with an icon or word.
- **Type:** headings use the self-hosted geometric display face Space Grotesk; reports and controls use the self-hosted practical sans face Atkinson Hyperlegible. Monospace data uses the local UI-monospace stack, with tabular figures. The pairing feels like hand-lettered signage above an exacting manifest.
- **Scale:** 12, 14, 16, 20, 28, 44, and 64 px. Body copy never drops below 16 px. Long copy is limited to 68 characters.
- **Spacing:** an 8 px base grid, with 4 px used only for tight label-to-value relationships. Sections breathe at 80–120 px on desktop and 56–72 px on mobile.
- **Shape and depth:** clipped ticket corners, inset keylines, and offset neon shadows replace generic rounded SaaS cards. Rules and dotted leader lines evoke inventory slips. Surfaces are grouped only when they represent distinct scan stages.
- **Interaction grammar:** the primary action is a mint “inspection stamp.” Hover and focus shift it by 2 px as though pressing a stamp. File rows light from left to right once inspected. All controls are at least 44 px.
- **Motion:** one 240 ms sign-on entrance and 180 ms result transitions use opacity and transform only. Nothing loops. Under `prefers-reduced-motion: reduce`, movement is removed and state changes are instantaneous.
- **Responsive intent:** at 390 px, the command rail stacks, the hero illustration is cropped to its inspection window, report metrics become a two-column ledger, and secondary navigation moves below the primary action. No essential scan or purchase action is removed.

## Original asset plan and provenance

The hero is a purpose-made raster illustration of a neon-lit archive inspection counter: sealed note crates move through a scanner while paper clips, audio cassettes, image cards, and link tags resolve into a clean manifest. It explains the product’s preflight job without showing a generic app dashboard. Generated locally with `/opt/fleet/lib/gen-image.sh` using the factory image deployment, then converted to responsive WebP. No brand marks, legible text, people, or third-party assets are included.

Final prompt: “Wide editorial night-market illustration for a local-first notes migration inspection utility. A compact street-stall workbench at midnight, sealed archive crates and paper note bundles entering a luminous inspection gate; image cards, a small audio cassette, paperclip attachments and chain-link tags emerge neatly counted into a paper manifest. Deep charcoal ink background, mint neon inspection light, amber caution accents, faint violet secondary glow, tactile screenprint grain, sharp geometric silhouettes, restrained cinematic depth, clear focal point on the scanner, ample dark negative space at upper left for web copy. No people, no logos, no readable words, no UI screenshot, no gradients, no watermark.”

