# Changelog

## Unreleased

- **Care** page (nav: Care). Cleaning and upkeep by interval, weekly to yearly, as dated ticks on
  the device: balls, glass, playfield (Novus 1, no ammonia or solvents), plastics, rubbers, wax
  (carnauba, no silicone), coil sleeves, the manual's two grease points, connectors (DeoxIT on
  pins, paper through switch contacts, never spray on switches or optos), fuses, level and pitch,
  the yearly Test Report. Same component and storage as the setup guide (`SetupGuide` gained a
  `noun` prop); the battery tick is shared with Setup step 7. Data in `src/data/care.ts`.

- **Setup guide: LED kit and upkeep.** A.1 25 Allow Dim Illumination is now suggested NO because
  the machine gets an LED kit (WPC dims the GI by chopping the mains and LEDs flicker); the GI
  Power Saver item notes the same. A seventh step, Upgrades and upkeep, records the first parts
  round (LED kit, flipper plungers and links, rubber kit, ramp covers and decals) and the CPU
  battery change as dated ticks, with a "later, only if needed" list for balls, NVRAM and hole
  protectors.

- **Machine setup** page (nav: Setup). Presets, free play, standard adjustments, high score table,
  the six H-4-only adjustments and the post-move utilities as a six-step guide with the suggested
  value, the reason, a link to the Handbook heading, a field for what the machine is actually set
  to and a Done tick. Values live on the device (`tafh:setup`) and travel in the backup file. The
  advice is data in `src/data/setup.ts`.

- **Shared cause for lamps.** Two or more lamps in one matrix column or row now get the same
  warning card as switches, naming the driver transistor and connector (`lampSharedCauses`).
- **Paste the whole Test Report.** The Diagnose field is a textarea; headings, names and prose in a
  multi-line paste are dropped and only the codes stay. `switch 32`, `lamp 55`, `solenoid 7` and
  `Check Switch 32 and 68` parse. A bare digit is no longer read as a solenoid.
- **Service log per component.** Every status change is appended to a short history (last 10)
  shown under the note on the card; a Fixed component keeps its log.
- **Device data** section on the Shopping list page: download all status as JSON, read a backup
  back (merge, newer wins, or replace), clear everything with a two-tap confirm.
- **Verify** page: the open questions from `kit-docs/KNOWN-ISSUES.md` as a checklist with links to
  the affected cards, maps and scans. Ticks are stored on the device with a date.
- Print stylesheet: nav, buttons and fields hidden, light palette, cards kept on one page.
- Tests: parser edge cases, lamp shared causes, status import/export, and e2e for the above.

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
