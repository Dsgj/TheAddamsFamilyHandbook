# Changelog

## Unreleased

- Icons: every chevron, row tile and bar icon is drawn from one list. On a
  component page both Location rows carry a tile, so their text starts at one
  x; the previous/next buttons use the lists' chevron; the viewer's rotate
  button shows a page turning inside the arrow.
- Device data: the restore mode select draws the same chevron as the Manuals
  pick list, in place of the browser's.
- Search: the exact code comes first, then the rows whose name holds the
  word, so "flipper" lists the Fliptronics switches and the flipper coils
  before the lanes named after them, and the All preview spreads its five rows
  over the kinds. A short word ("LLF") matches a manual page only at a word
  start, and pages whose snippet is mostly garbled OCR sort after the clean
  ones.
- Tables: when no table matches the typed text, a "Search everything for q"
  link opens the whole search with it.
- Diagnose: "switch 32 is stuck closed", "32–68" with a dash and "SW32SW68"
  all read as their codes, and C0 is no longer Solenoid 00. The header counts
  the recognised codes, and a fuse or connector the search below finds is
  "Found below" rather than "Not recognised". The field no longer autocorrects.
- Shared cause: three or more parts on one connector "all go to" it; lists in
  the text read "31, 32 and 33".
- Tables: a matrix link whose hash is no URI escape (`#c%E0`) loads without a
  page error; "Show all N handbook headings" names what it counts.
- Map: a pinch holds the point under the fingers from its first frame; it used
  to drift sideways by up to a finger's width over a spread from the fitted
  drawing.
- e2e: the map's pinch and double tap have tests, and swipe back now runs in
  WebKit too, the engine of the installed iPhone app; one shared touch helper
  drives Chromium through CDP and WebKit through the events a finger produces.
- The four flipper coils are components of their own: each has a page with
  its wiring, fuse, status row, note and service log, a Fault tick on the
  Solenoids page and a place on the shopping list, and the search opens the
  page instead of the table.
- "Not tested" is one state: pressing it while it is already chosen changes
  nothing, so the matrix, the map and the service log never change under a
  button that still says chosen. On the map a selected Fault keeps its red
  fill and halo; selection is an amber ring around the marker, not a fill.
- Printing keeps what the screen's controls hold: /setup prints each row's
  suggested and set values as text, a component page prints its note, a table
  shrinks to fit an A4 page whole (the coil tables kept their Location and
  Fault columns off the paper), and /shopping prints without the Device data
  backup controls.
- On a desktop the handbook's contents sidebar now follows the article in
  reading order, so "Skip to content" and the first Tab reach the text instead
  of some 280 contents links; the current section is marked for assistive
  tech, not only by colour; and the reader bar sits at the foot of the article
  column, clear of the sidebar, with the next section's short title whole.
- Handbook tables no longer break a hyphenated code ("Blu-Org", "FL-11753")
  across two lines on a phone, and each table's scroller is a named region
  the keyboard can reach, so it scrolls with the arrow keys in every browser.
- On a tablet or desktop, a control that ends a row ("Add to list" on a part
  row) now sits at the row's end, where every chevron sits, instead of mid-row
  after the text. Checklist statements and the progress line stop at the
  measure, the status control stops at 480 px, and the Handbook home is a hub
  of the Workshop hub's width, so the three hubs share one width rule.
- A component page, the Shopping list and the Device data summary no longer
  show a server default ("Not tested", the pressed Not tested segment, "No
  status changes yet.", "Nothing marked Fault yet", "Nothing saved on this
  device yet.") for the moment before the page has read this device's storage.
  They stay blank until then and show the saved state straight away.
- A Fault on a component the kit records no part number for (the flipper
  switches F1 to F8) no longer shows as "no part number ()" on the Shopping
  list: the group is labelled "no part number recorded" with nothing in
  brackets, and the counter says how many such items sit under the parts to
  order instead of counting them as parts.
- The end-of-stroke switches' hint is the manual's own text (p. 2-16 and
  the parts lists), so it is now headed "From the manual" with a tag that
  says so, instead of being passed off as the owner's experience. The
  other switch hints keep the "Owner's hint" heading and tag.
- The lamp matrix drivers are on the power driver board, as the manual has
  them, not on the CPU board: both lamp shared-cause hints and the lamps'
  owner note now say so. The Lamp matrix page's lead reads its connectors
  and driver ranges from the data (J137/J138, Q98–Q91; J133, Q90–Q83).
  Appendix A3 no longer calls the flipper buttons opto boards: they are
  leaf-switch pairs read on J805, as A6 and the kit data say.
- Device data that has been damaged or hand-edited no longer breaks the app:
  a `null` or malformed entry under a saved status, setting, Verify tick,
  recent search or viewed component is dropped on read, so every page still
  opens and Clear all still clears. A restored file's keys are spelt the way
  the app spells them (`coil:7` is `coil:07`), entries for components the app
  has no row for are skipped and the restore message says how many, and the
  home's open-faults count only counts components the Shopping list shows.
  Merging a backup keeps the status that was set last by the service logs, so
  a note typed later on one device no longer undoes a Fault marked on the
  other. A picked file the browser cannot read says so instead of failing
  silently.
- The Workshop tab's shopping-list count shows on a page that keeps the
  browser busy too: it waits at most 200 ms for an idle moment, as it
  already did in Safari.
- A component's link to its location map in the manual (pp. 2-39 to 2-41)
  now opens the page zoomed to the component's printed callouts, ringed in
  amber, rather than at the top of the whole page.
- Zoom in on the map no longer zooms out: pinched past 2.4x, it used to drop
  back to 2.4x, and now it keeps the zoom.
- The Docker image caches the scans, brand images and fonts for a day rather
  than for a year as immutable, so a changed image reaches the browser after a
  release; only Astro's hashed bundle stays immutable.
- The manual viewer's shortcuts ignore Shift and Caps Lock (R and T as well
  as W and P), and `_` zooms out as `-` does, the same keys as on the map.
- Copying or sharing Diagnose results, the shopping list or the map's
  calibration JSON now confirms with a toast. Where the clipboard refuses, the
  shopping list and the calibration card still show the text to copy by hand.
- The manual's fit choice is kept under the app's own name; a choice made
  before the rename carries over.
- A component's wiring reads the same on its card, its page and the map
  sheet. The sheet now says "Installed LED", shows when a coil's fuse comes
  from the fuse list, and tags an owner's hint "(owner's experience, not the
  manual)" in the same box as the card. A card with no callout says "No
  callout on the location map" instead of a dash, and its fuse and page links
  are underlined like every other text link. The handbook's map embed lists
  lamps as L11, not 11.
- The data tells one story. Appendix A2 and A5 point to Verify where the
  manual disagrees with itself about the magnets, and Verify has a new item
  for the magnets' supply. Every fuse on a card, a map card or the Coils
  page reads "F105 (3A S.B.)" and links to its row on the Fuses page. Part
  and assembly numbers on a component's page and its map sheet link to the
  Parts list when it carries them. Diagnose spells wire colours out ("Grey"), the fuse list writes
  "GI 1, White-Brown", and three Setup and Care links to the handbook that
  had gone missing are back.
- Backups use two verbs: Download backup and Restore from backup, with
  "When restoring" for merge or replace and "restored" in the result. A
  component page's title and its map sheet read "Switch 32, Upper Right
  Jet". Verify's links say "F1: Details" and "L13: Show on map", and other
  pages are named by their titles. Touch phones no longer see the
  arrow-key hint on the Switch matrix. README describes the theme choice
  in Workshop › Appearance.
- The browser's colour bar now follows the Light or Dark choice in
  Appearance, not only the system setting. Spacing, type sizes, icon buttons,
  status pills and screen-width steps follow one set of rules across the app.
  The handbook's side contents and the manual's three columns now start at
  the same width as the map's side panel. The manual's page counter is back
  in the code typeface.
- **Focus rings show whole, and the page reads in order.** A keyboard focus
  ring is no longer cut off at the edge of a list, a row of chips, a
  scrolling table or the side rail. Screen readers now meet the page title
  and content before the tab bar. Dimmed map markers keep a clear outline
  beside the selected one. Handbook figures keep their space while they load,
  and their captions are no longer read twice. The handbook's Previous and
  Next buttons are named with the page they show.
- **Large screens line up.** From 1280 the sidebar's sub-pages use the same
  text size as the main tabs. Two Diagnose results side by side keep their
  own buttons instead of stretching to match each other, and a single result
  lines up with the field above it. The map's layer buttons beside the panel
  show their names. Long lines on the shopping list and in the shared-cause
  text wrap at a readable width. The switch-matrix headers all have the same
  height. Search fields line up with the lists under them.
- **Setup, Care and Verify look like one checklist.** Each row has its tick box
  at the top left, the text beside it and its links underneath, and each page
  shows its progress the same way: a count, a word and a bar. Text fields have
  the same corners and line height everywhere.
- **Reading on a phone is easier.** A table cut off at the edge of the screen
  now fades out on the side that has more to show, so you can see it scrolls.
  The manual search field reads "Search" instead of a cut-off word. The end of
  a handbook section is no longer hidden behind its toolbar, and the Text size
  panel is small and leaves the page visible while you choose. On the map the
  drawing moves left so the zoom buttons no longer cover its right edge, and on
  a manual page the zoom buttons sit under the scan. A manual page's title bar
  names the subject ("Shot maps") when it fits. A part you have not tested
  shows "Not tested" as chosen. Smaller fixes: the fuse and LED tables line up,
  the Workshop rows have their own icons, page ranges and part numbers no
  longer break at the hyphen, and the dark title bar is a little more solid.
- **Diagnose and lists fit a phone better.** Over results and a search the
  field at the foot is slimmer and its heading is gone, so it takes about a
  fifth of the screen. On a phone on its side the field sits above the results
  instead of covering half of them. A "saved" or "copied" note no longer lands
  on the field on Home. A long part name beside a shared cause now puts the
  explanation underneath at full width, and titles in a list line up after
  their codes.
- **First taps are quicker on a phone.** The handbook Contents opens faster,
  the map is ready sooner, the drawing in a handbook page loads only when you
  scroll to it, and a few page parts start up when they are needed rather than
  at once. A map link that opens a part at a zoom now lands in place, and the
  part's sheet is simply there instead of rising in.
- **The map and manual pages no longer jump as they load.** The map drawing
  and a manual page now take their final size before the page becomes
  interactive, so the side panel and the page below no longer move once it
  does.
- **Clicks and messages behave.** A Ctrl or Cmd click on the tab you are on
  opens it in a new tab again. With site data blocked, the back link and swipe
  still work. A message that follows another within a few seconds stays for
  its full time, and so does a Clear that is asked twice. Dragging the map's
  sheet with a mouse leaves it where you dragged it. The search fields no
  longer autocorrect or capitalise what you type.
- **The workshop lists link up.** A note you type on a Fault now shows on the
  Shopping list and in the text you copy from it. Diagnose says how many
  faults are open and links to the list, and Clear under Recent asks once
  more before it empties it. A code chip in Diagnose jumps to its card. A link
  to one switch or lamp opens the table with that cell selected and its panel
  in view, a link to a coil lands on its row, and a part the map does not draw
  says where it is instead of offering Show on map. The Workshop rows say what
  each list holds.
- **Component cards fit where they are shown.** On the map, the selected
  part's card no longer repeats the drawing or links to the map you are on.
  The 33 parts the map does not draw, such as the coin door switches and the
  flipper buttons, say where they are instead of offering Show on map. The
  small drawing keeps a part at the edge of the playfield whole and in the
  middle. A part marked Fault is a filled red dot on the map, and a part drawn
  at several places names each one apart for a screen reader.
- **Update and install prompts are reliable.** The "new version is ready"
  message no longer gets lost when it arrives while the page is still
  starting. Pull to refresh on the Workshop says "Downloading an update"
  while one downloads instead of "up to date". Install works again after
  you once dismissed the browser's prompt.
- **Search finds handbook text.** A word search now looks in the text under
  every handbook heading, not only in the headings, and shows the words
  around the match. Repeated rows show once, "Show all" says what it counts
  (manual pages, handbook sections), and on a phone the button reads Search
  and Enter brings the hits up under the header.
- **Data that does not load says so.** The parts list, the manual search and
  the Diagnose search show what did not load with a Retry button instead of
  waiting forever or showing nothing. A search fetches each data file once. A
  manual page whose scan is not on the device offline shows only the card
  with Show the text, without an empty frame or zoom buttons.
- **Go to page takes the page numbers the header shows.** In the Operations
  Manual you can type "2-39", "p. 2-39" or "E", and a number the manual does
  not print says so instead of opening another page. The field offers a text
  keyboard there.
- **Diagnose takes codes the way they are printed.** "Check Switch 32.",
  "#32" and "32-68" now read as codes. A part number such as a fuse (F105) or
  a connector (J206) is searched in the components, handbook, manuals and
  parts right under the Not recognised line. Text with no code in it says
  what to type and no longer offers Share results.
- **Your records survive every round trip.** Recent keeps a pasted
  multi-line report as it was, so replaying it finds the same codes. A
  service log or a backup with two entries at the same moment opens and
  imports cleanly. When this device's storage refuses to save, the app says
  so once, and a restore that cannot be kept reports that it failed.
- **Back to Diagnose results returns to your card.** Coming back from a
  component to a list of results, by the header's back or the phone's own,
  shows the card you opened instead of the top or the bottom of the list.
- **Swipe back leaves sheets and wide content alone.** An edge swipe no longer
  leaves the page while a sheet such as Contents or Go to page is open, on a
  zoomed manual page, or on a handbook table that is scrolled sideways.
- **The map never covers the top bar.** Scrolling past the shot map in the
  handbook's Rules section on a phone, its controls slide under the top bar
  instead of over Back and the manual button. On /map with a phone on its
  side, the layer list and the zoom buttons sit side by side, so they stay
  below the bar with a part selected.
- **The LEDs fitted in this machine.** Every lamp now names the LED from the
  machine's Super Brite Kit sheet ("555 Warm Super"), so a dead lamp tells you
  what to order: on the lamp's card and page, in the map's lamp card, in a new
  Installed column on Lamps, and on the Shopping list, which groups lamps by
  that LED with the socket type and bulb part in brackets. Lamps also lists the
  kit's flasher LEDs. The list is the owner's, kept beside the kit's data and
  laid onto its lamps when the app is built, so a kit update keeps it and a
  wrong lamp number stops the build.
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
- **No Swedish left from the kit's data.** Every component, fuse and table
  reads in English. The magnet fuse on solenoids 16, 23 and 24 reads "5A S.B.
  (under the playfield)", as the manual prints it. The menu map's P.1 to P.8
  links open their headings, and the three fuse rows the manual prints
  without an id each have their own link. Verify asks which G.I. wire colours
  the machine has, where the G.I. table and the fuse list disagree. P4 item 3
  of the app audit (AR-01, DA-02, AR-03, DA-05, DA-03, DA-04, DA-12, DA-07,
  DA-09, DA-16).
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
