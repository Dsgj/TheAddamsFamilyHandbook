# Changelog

## Unreleased

- **The Rules map keeps its controls off the drawing.** On a tablet or desktop,
  the shot map in the handbook's Rules section no longer lays its layer list,
  zoom readout or keyboard legend over the playfield. Where the margin beside the
  drawing holds them they float there, the legend stacked under the layer list;
  where it does not, the map keeps the phone's control column beside the drawing
  and the keyboard legend sits under the map. This also makes the deploy pipeline
  green again: its e2e jobs failed on this, and on a toast test that the real
  service worker's own "Ready to work offline" toast kept alive.
- **Lighter pages.** Installing the app stores about 16.5 MB instead of
  about 21.5 MB, and every page weighs less on a first visit. Phones no longer
  download the logo (it shows only in the desktop sidebar, now a 480×243 file
  of the same image). A tiled manual page shows its overview first and loads
  the four zoom tiles only when you zoom in, or at idle once the app is
  installed, so they still zoom offline. A handbook section carries its
  contents once in the page instead of twice as island props (about 110 KB
  less per section), and Contents still opens offline. The Workshop badge
  reads its ids from one script, the kit dataset leaves the Shopping list's
  code, and the unreferenced 1.25 MB source drawing moved from `public/` to
  `kit-docs/`. Pages look the same. P4 item 5 of the app audit (PF-05, PF-06,
  PF-09, PF-10, SV-05, SV-10, SV-11, AR-07, AR-08).
- **Gated deploys.** Every pull request and push to main runs check,
  svelte-check, lint, prettier, vitest, build and the Playwright suite on three
  projects (a WebKit iPhone 13 at 390×844 joins); only a green main deploys. Axe
  scans 26 routes; a unit test proves every built link, icon and precache URL
  resolves. Line endings are LF in git; a stale preview can no longer be tested
  by mistake. No page changes.
- **One name per thing.** Fault replaces Broken on the tick column; codes are
  32, L55 and SOL 01; one name per page; one verb per destination (Show on map,
  Details, Manual p. n); UK spelling with Grey; dates carry the year and use
  local time; 'n of m' progress; 'and' in titles; every page has its own
  description. "p." stands only before a page number the manual prints, other
  pages read "PDF page n"; the app is "The Addams Family Handbook" or "the app"
  (TAF Handbook stays the home-screen label). The glossary and six copy rules
  are spec §13, and `tests/unit/copy.test.ts` checks the rules on the source.
  Words only: stored values, the backup format (version 2), the storage keys,
  routes and anchors are unchanged, and the manual's own text keeps its words.
  P3 item 1 of the app audit (CP-01 to CP-20, UX-06, UX-07, UX-10, CR-09).
- **App audit fixes P0 to P2.** A full audit of the redesigned app
  (`.claude/tasks/app-audit.md`), fixed in order. P0: the Diagnose field no
  longer refills itself, every URL with a query string works offline, the phone
  layout no longer widens past the screen, notes and setup values save as you
  type and survive Back, backups are validated and include the Verify ticks,
  the manual search opens the page you tapped, the Parts results no longer
  vanish on duplicate rows and handbook photos are cached. P1: header and swipe
  back go back instead of forward, Back from a card returns to the results, and
  map links keep the kind. P2: the header title no longer overlaps the back
  label, the component migration is finished (one button family, one search
  field, type tokens, a z-index scale), the light theme and print use the right
  ink, tables and the map side panel fit phone and desktop, and the map, setup
  inputs, matrices and live counts are accessible.
- **The app redesign, in twelve phases.** Tokens and the fitted playfield map
  (1); map selection, the sheet and the side panel (2); hubs, the list
  vocabulary and Appearance (3); the navigation shell with five tabs, Diagnose,
  Map, Tables, Handbook and Workshop (4); the top bar, back links and the token
  migration (5); the Diagnose home, results and search (6); the switch matrix
  tabs, component detail and Recently viewed (7); the Handbook home, the reader
  toolbar, the manual viewer and Parts (8); the Workshop screens (9); the
  install surface (10); system states (11); motion and navigation continuity
  (12). The design spec is `.claude/tasks/app-redesign-spec.md`.
- **Setup guide: Add-A-Ball instead of Novelty.** The machine goes in a
  separate game room, so game length matters less and an extra ball beats a
  points bonus. The presets step now installs U.9 08, the standard adjustments
  gain the extra-ball and replay items that hang on it (A.1 03, 05, 06, 08, 14,
  15), the Thing Knocker item says the coil is optional, and U.5 spells out both
  frames of the custom message. The knowledge bank follows.
- **One playfield drawing instead of three scanned maps.** The map and the
  mini-maps now draw on a clean line drawing of the playfield
  (`assets/maps/playfield.png`, 169 KB) with markers coloured by kind and by
  status; the selected part pulses and the others dim, and all three kinds can
  be shown at once. Positions live in `src/data/positions.json`, seeded by
  remapping the manual's callouts and corrected by hand in the new calibration
  mode (`/map?calib=1`: drag or arrow-key a marker, copy the JSON). The owner
  calibrated all 17 shots and 95 component markers against the overlays on
  2026-09-24; only off-playfield parts (Start button, THING and credit lamps)
  sit on the edge. The manual's callout coordinates stay untouched in the kit
  data.
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

- **Care** page (Workshop: Care). Cleaning and upkeep by interval, weekly to yearly,
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

- **Machine setup** page (Workshop: Machine setup). Presets, free play, standard adjustments,
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
- **Shopping list** page (Workshop: Shopping list). Every component marked Fault,
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
