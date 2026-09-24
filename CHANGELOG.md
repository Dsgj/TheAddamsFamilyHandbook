# Changelog

## Unreleased

- **One playfield drawing instead of three scanned maps.** The map and the
  mini-maps now draw on a clean line drawing of the playfield
  (`assets/maps/playfield.png`, 169 KB) with markers coloured by kind and by
  status; the selected part pulses and the others dim, and all three kinds can
  be shown at once. Positions live in `src/data/positions.json`, seeded by
  remapping the manual's callouts and corrected by hand in the new calibration
  mode (`/map?calib=1`: drag or arrow-key a marker, copy the JSON). The manual's
  callout coordinates stay untouched in the kit data.
- **Shots layer and combinable layers.** The manual's two shot maps (PDF pages 9
  and 10, letters A–S) become a fourth layer on the drawing, seeded from the
  arrow tips of the figures. The layer buttons now toggle, so any combination
  can be shown, and the rules section of the handbook embeds the map after
  page 9 with the shots on. Start page gets a "shots" quick link.
- **Calibration overlay.** `?calib=1` can lay the original manual scan (switch,
  lamp or solenoid map, or either shot page) over the drawing, frame-aligned and
  with adjustable opacity, so markers can be matched against the print.
- **Backbox inspection folded in (observed 2026-09-24, photo).** The machine
  card and knowledge bank in kit-docs record: game ROM L-4 on an ST M27C2001 at
  U6 (H-4 swap still worthwhile, jumpers W1 in / W2 out unchanged), an anyPin
  NVRAM module at U8 with no batteries, the Fliptronics TIP102 row replaced in
  1999, board part numbers and 1992 date codes, taped connectors from earlier
  service. In the app: A.1 24 Show Date and Time suggested NO; the batteries
  step in Setup and Care is now an NVRAM check; the Problem Analysis owner's
  note, A5 and A6 carry the machine-specific facts; Verify has a "This machine"
  group (old cells, W16, serial, A.1 24).
- **Thing Knocker coil missing.** The coil 02 card, the A2 resistance table and
  a new Setup step under Upgrades and upkeep record that this machine has the
  A-15267 bracket and rubber pad but no AE-23-800 coil, with what to buy and
  how to fit and test it.
- **Flipper buttons are leaf switches.** A6 and the F2/F4/F6/F8 service notes said
  optos; the cabinet parts list and the Fliptronics wiring (button assembly
  B-12273-6, orange switch ground on J805-6) say stacked leaf switches with a
  three-wire connector per button.
- **First measured coil value.** AE-23-800 reads 4.7–4.8 Ω on this machine's Thing
  Kickout (4.9 on the meter, 0.1–0.2 Ω leads, now A1 rule 8); the A2 table and the coil cards now say measured instead of forum.
- **Appendices applied in the guides, in plain text.** Every component page
  carries a service note written for that part (coil resistance from the A2/A6
  tables with its source mark, driver transistor, fuse, tieback; switch column
  and row, opto or contact cleaning; lamp column and row drivers, ghosting)
  followed by the appendix links. Setup's LED kit, flipper links and batteries
  steps, the Care switch test and coil sleeve items, the Verify EOS item and the
  Diagnose shared-cause lines now say what the appendix says and link to it.
  The manual pages for the solenoid table, coin door switches, T.1, T.4, T.8,
  Problem Analysis, the Fuse List and Maintenance Information show an
  Owner's note under the transcription. The Shopping list ends with a fixed
  Service kit section (terminals, crimp tool, cleaners, card stock, spares).
- **Care: inspection before cleaning.** The yearly round now starts with the CPU
  battery area, J122 and both diode tieback groups, and the GI connectors
  J115/J120/J121, in that order, with the connector rules from appendix A7. The
  Care warning says when a connector is replaced rather than sprayed.
- **Owner appendices A1–A8 in the Handbook.** Eight pages of the owner's own
  service notes after the manual (Handbook → Appendix, pages 101+): A1
  Multimeter basics, A2 Coils, magnets and motors, A3 Switches and optos, A4
  Lamps, flashers and GI, A5 Power driver board, A6 Flippers, A7 Connectors and cleaning, A8 Shopping out the playfield. PinWiki's Addams Family notes (J122 tieback, magnet wiring, Extra Flipper Supply, Fliptronics I/II, Bear Kicks) and its shop-out guide are folded in, reworded, with the board photos shown with permission (rights remain with PinWiki). Written from PinWiki and vendor guides with a source per section and
  a confidence mark; a banner says they are not manual text and there is no Scan
  button. Every switch, lamp and solenoid page lists the appendices that apply
  to it under "Service notes" (`src/data/appendix.ts`). Files are
  `src/content/handbook/app1NN.md`; the loader, contents, search and `#find:`
  links treat them as handbook pages.

- **Care** page (nav: Care). Cleaning and upkeep by interval, weekly to yearly,
  as dated ticks on the device: balls, glass, playfield (Novus 1, no ammonia or
  solvents), plastics, rubbers, wax (carnauba, no silicone), coil sleeves, the
  manual's two grease points, connectors (DeoxIT on pins, paper through switch
  contacts, never spray on switches or optos), fuses, level and pitch, the
  yearly Test Report. Same component and storage as the setup guide
  (`SetupGuide` gained a `noun` prop); the battery tick is shared with Setup
  step 7. Data in `src/data/care.ts`.

- **Setup guide: LED kit and upkeep.** A.1 25 Allow Dim Illumination is now
  suggested NO because the machine gets an LED kit (WPC dims the GI by chopping
  the mains and LEDs flicker); the GI Power Saver item notes the same. A seventh
  step, Upgrades and upkeep, records the first parts round (LED kit, flipper
  plungers and links, rubber kit, ramp covers and decals) and the CPU battery
  change as dated ticks, with a "later, only if needed" list for balls, NVRAM
  and hole protectors.

- **Machine setup** page (nav: Setup). Presets, free play, standard adjustments,
  high score table, the six H-4-only adjustments and the post-move utilities as
  a six-step guide with the suggested value, the reason, a link to the Handbook
  heading, a field for what the machine is actually set to and a Done tick.
  Values live on the device (`tafh:setup`) and travel in the backup file. The
  advice is data in `src/data/setup.ts`.

- **Shared cause for lamps.** Two or more lamps in one matrix column or row now
  get the same warning card as switches, naming the driver transistor and
  connector (`lampSharedCauses`).
- **Paste the whole Test Report.** The Diagnose field is a textarea; headings,
  names and prose in a multi-line paste are dropped and only the codes stay.
  `switch 32`, `lamp 55`, `solenoid 7` and `Check Switch 32 and 68` parse. A
  bare digit is no longer read as a solenoid.
- **Service log per component.** Every status change is appended to a short
  history (last 10) shown under the note on the card; a Fixed component keeps
  its log.
- **Device data** section on the Shopping list page: download all status as
  JSON, read a backup back (merge, newer wins, or replace), clear everything
  with a two-tap confirm.
- **Verify** page: the open questions from `kit-docs/KNOWN-ISSUES.md` as a
  checklist with links to the affected cards, maps and scans. Ticks are stored
  on the device with a date.
- Print stylesheet: nav, buttons and fields hidden, light palette, cards kept on
  one page.
- Tests: parser edge cases, lamp shared causes, status import/export, and e2e
  for the above.

- Renamed the app from Valvet to **The Addams Family Handbook** (PWA short name
  "TAF Handbook"). Header, page titles, manifest and package name updated.
  Device status and theme keys moved to `tafh:*`; the old `valvet:*` values are
  read as a fallback so nothing is lost.
- The Addams Family logo replaces the text mark in the header
  (`public/brand/logo.webp`, precached).
- README rebuilt: logo, screenshots (`docs/readme`), feature table, palette and
  roadmap.
- **Broken tick.** A Broken checkbox per row in the lamp, switch (J205, J806)
  and solenoid tables writes the same device-local Fault status as the component
  cards, so the matrices and the map recolour live. The Lamps page gained a full
  lamp table (bulb type, bulb part, assembly) under the matrix.
- **Shopping list** page (nav: Shopping list). Every component marked Fault,
  lamps grouped by bulb type with count and bulb part, switches and solenoids by
  part number with assembly, each linked to its card. Copy as text
  (`2 × #555 (24-8768): L11 Thing Multiball, L12 …`) and a Fixed button per part
  that clears the status.
- e2e: the map-marker test now waits for the island to hydrate before clicking;
  it raced under parallel load.

## M1 — Foundation and parity (2026-09-23)

First milestone: everything the prototype did, rebuilt as an installable static
site.

### Added

- Astro 7 + Svelte 5 scaffold, design tokens, dark (default) and light themes,
  English UI.
- Diagnose: paste a Test Report or display message, get one card per component
  with wiring chips, mini-map, callout link, per-component status + note, and a
  shared-cause check (column, row, connector, EOS mechanics).
- Playfield map: switch, lamp and solenoid layers, three zoom levels, markers
  coloured by status, URL state (`?layer&id`).
- Switch and lamp 8×8 matrices with keyboard navigation, dedicated switch tables
  (J205, Fliptronics J806), solenoid / flasher / flipper coil / GI tables, fuses
  by board, LEDs, jumper pointer.
- Handbook reader: 56 transcribed pages grouped in 10 sections, page markers
  with scan links, menu map, searchable table of contents, `#find:` / `#goto:`
  links resolved at build time.
- Manual page viewer for the three scanned documents (ops 124, handbook 12, WPC
  schematics 14 with tiles): fit / zoom / rotate / text mode, keyboard, OCR
  search across all documents.
- Parts list: 2 562 rows with assembly path, search from two characters.
- Quick search in the header (components + handbook headings).
- PWA: manifest, icons, precached shell, data, maps and figures (394 entries,
  1.67 MB); scans cached on first view.
- GitHub Pages workflow, Dockerfile + nginx + compose, unit tests (codes, shared
  cause, handbook build) and Playwright smoke tests (8 scenarios × phone-dark /
  desktop-light).

### Data caveats surfaced in the UI

- Solenoid fuse assignments are derived from the schematic, not printed per
  coil; marked "derived".
- Switch hints are the owner's experience, marked as such; the EOS switch type
  note says the manual pages disagree.
- Handbook pages 26–28 are marked unverified transcriptions.
- The prototype's flasher count (14) differs from the manual's (15); the table
  follows the manual and says so.
- Callout markers are snapped to the printed number, not the physical part;
  Vault switch 68 has no callout on the map.
- Check Switch reporting threshold, H-4 adjustment names and the custom message
  format are noted as unverified where they appear.

### Not done / open

- Deployed to <https://dsgj.github.io/TheAddamsFamilyHandbook/> from the public
  repo Dsgj/TheAddamsFamilyHandbook (owner chose public).
- Docker image not test-built locally.
