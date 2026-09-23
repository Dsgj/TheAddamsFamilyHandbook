# Changelog

## Unreleased

- Renamed the app from Valvet to **The Addams Family Handbook** (PWA short name "TAF Handbook").
  Header, page titles, manifest and package name updated. Device status and theme keys moved to
  `tafh:*`; the old `valvet:*` values are read as a fallback so nothing is lost.
- The Addams Family logo replaces the text mark in the header (`public/brand/logo.webp`, precached).
- README rebuilt: logo, screenshots (`docs/readme`), feature table, palette and roadmap.
- **Broken tick.** A Broken checkbox per row in the lamp, switch (J205, J806) and solenoid tables
  writes the same device-local Fault status as the component cards, so the matrices and the map
  recolour live. The Lamps page gained a full lamp table (bulb type, bulb part, assembly) under the
  matrix.
- **Shopping list** page (nav: Shopping list). Every component marked Fault, lamps grouped by bulb
  type with count and bulb part, switches and solenoids by part number with assembly, each linked
  to its card. Copy as text (`2 × #555 (24-8768): L11 Thing Multiball, L12 …`) and a Fixed button
  per part that clears the status.
- e2e: the map-marker test now waits for the island to hydrate before clicking; it raced under
  parallel load.

## M1 — Foundation and parity (2026-09-23)

First milestone: everything the prototype did, rebuilt as an installable static site.

### Added

- Astro 7 + Svelte 5 scaffold, design tokens, dark (default) and light themes, English UI.
- Diagnose: paste a Test Report or display message, get one card per component with wiring chips,
  mini-map, callout link, per-component status + note, and a shared-cause check (column, row,
  connector, EOS mechanics).
- Playfield map: switch, lamp and solenoid layers, three zoom levels, markers coloured by status,
  URL state (`?layer&id`).
- Switch and lamp 8×8 matrices with keyboard navigation, dedicated switch tables (J205, Fliptronics
  J806), solenoid / flasher / flipper coil / GI tables, fuses by board, LEDs, jumper pointer.
- Handbook reader: 56 transcribed pages grouped in 10 sections, page markers with scan links, menu
  map, searchable table of contents, `#find:` / `#goto:` links resolved at build time.
- Manual page viewer for the three scanned documents (ops 124, handbook 12, WPC schematics 14 with
  tiles): fit / zoom / rotate / text mode, keyboard, OCR search across all documents.
- Parts list: 2 562 rows with assembly path, search from two characters.
- Quick search in the header (components + handbook headings).
- PWA: manifest, icons, precached shell, data, maps and figures (394 entries, 1.67 MB); scans cached
  on first view.
- GitHub Pages workflow, Dockerfile + nginx + compose, unit tests (codes, shared cause, handbook
  build) and Playwright smoke tests (8 scenarios × phone-dark / desktop-light).

### Data caveats surfaced in the UI

- Solenoid fuse assignments are derived from the schematic, not printed per coil; marked "derived".
- Switch hints are the owner's experience, marked as such; the EOS switch type note says the manual
  pages disagree.
- Handbook pages 26–28 are marked unverified transcriptions.
- The prototype's flasher count (14) differs from the manual's (15); the table follows the manual and
  says so.
- Callout markers are snapped to the printed number, not the physical part; Vault switch 68 has no
  callout on the map.
- Check Switch reporting threshold, H-4 adjustment names and the custom message format are noted as
  unverified where they appear.

### Not done / open

- Deployed to https://dsgj.github.io/TheAddamsFamilyHandbook/ from the public repo Dsgj/TheAddamsFamilyHandbook (owner chose public).
- Docker image not test-built locally.
