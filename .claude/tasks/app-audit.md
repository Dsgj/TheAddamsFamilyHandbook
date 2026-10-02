# Full app audit (2026-09-29)

**Status: P0 (645d614), P1 (00c83ad, back behaviour), P2 item 1 (dc21002, header), P2 item 2 (c210aa5, component migration), P2 item 3 (1be60ff, light theme and print), P2 item 4 (62d17e0, tables, matrices and large screens), P2 item 5 (623ab22, accessibility), P3 item 1 (1a14a76, one name per thing), P4 item 1 (579d801, presentation helpers), P4 item 2 (d3dcf87, split PlayfieldMap), P4 item 3 (9b853f7, kit data boundary) and P4 item 4 (CI and tooling) are committed on main, which closes P2 and P3. P4 item 5 (payload) is the last plan item and is not started.** Twelve specialist reviewers, one adversarial verifier per dimension and a completeness critic reviewed the whole app against a fresh build. There were 231 findings: 154 confirmed, 69 partly confirmed, 7 deliberate (documented decisions) and 1 refuted. Each finding below carries the verifier's recalibrated severity. The raw result, with evidence, repro scripts and a fix per finding, is in the workflow journal of session c5ab0448 (run wf_05057fc7-6a2). The rows here are enough to find each spot again.

The audit started from this baseline: build OK, astro check 0 errors (16 hints, all from the deprecated `z` import), eslint clean, vitest 57/57. The e2e suite was run against the fresh build and 315 of 318 tests pass. The phone-dark push-transition test in motion.spec fails even with one worker. svelte-check finds 7 errors, and `pnpm check` does not run svelte-check.

## Verdict per question

- **Code.** The base is sound and static-first: url.ts owns every link, thin [id] routes share one layout, the runes stores are typed, and status-io is pure and tested. It is not as good as it can be. Persistence has several silent data-loss paths. Presentation logic is re-derived in 7-8 places and has drifted. PlayfieldMap.svelte ships calibration tooling to users, and CI deploys after running only vitest and the build.
- **Design.** The spec is thorough, but the migration to it is half done. There are two type scales, four button specs and three search-field styles. 60 of 83 radii are literals, and there is no z-index scale. The light theme misses AA on the primary button and on amber text, because `--on-amber` and `--amber-ink` never fully landed.
- **UI.** The shell, map, component detail and hub pages are polished. Four handbook sections and /coils are wider than a phone and push the tab bar off-screen. Long header titles overlap the back label, and tables squeeze to one word per line.
- **Flow.** The core loop mostly works, but back navigation is the weak spot. The header back and swipe back push history. System Back loses Diagnose results. After any `?q=` URL, the Diagnose home cannot be reached.
- **Consistency.** This is the weakest area overall. One component shows under four or five codes, and Broken, Fault and Fixed name one state. "Handbook" means four things, and the same action has different labels on the card, the detail page and the map.

## Fix plan, in order

The findings are grouped by root cause, so one fix usually closes several of them.

### P0: breaks the core loop or loses data

1. **The Diagnose `?q=` effect refills the field** (CO-01, SV-01, UX-01). `Diagnose.svelte:33-36` tracks `input`, so Clear, Cancel, backspace-to-empty and the Diagnose tab all snap back. Read `?q` once, with `untrack` or in onMount. Add an e2e test: open `/?q=32`, press Clear, expect the home. Effort S.
2. **Offline fails for every URL with a query string** (CO-02, PF-01, PF-12). Workbox keeps its default `ignoreURLParametersMatching`, so `map?layer=…&id=…`, `/?q=32` and the tab links that motion.ts rewrites all hit the browser error page offline. Add `ignoreURLParametersMatching: [/.*/]` in astro.config.ts, and consider a `navigateFallback` to 404.html. Add an offline e2e test. Effort S.
3. **The phone layout blows out** (VP-01, VP-02, VL-02, AY-03, DS-12). `.hb` (`handbook/[section].astro:166`) and `.grid-2` (`base.css:288-296`) use `1fr`, which means `minmax(auto,1fr)`. Wide tables therefore widen the page to 589-722 px and hide the tab bar and the reader bar. /coils also scrolls sideways at every width from 600 to 1366. Use `minmax(0,1fr)` and `repeat(2,minmax(0,1fr))`. Add a per-route e2e sweep that checks `scrollWidth <= innerWidth`. Effort S.
4. **Data-loss paths** (CR-01, CO-04, SV-02, AR-02, CO-03, TT-03, AR-04, CO-13). Notes and setup values save only on `change`, so system Back drops them. The stores write a whole stale snapshot with no `storage` or `pageshow` resync. "Replace everything" accepts any JSON and wipes the statuses. Verify ticks are left out of backup and Clear. Build one `lib/storage.ts` adapter with per-key read-modify-write, resync on storage and pageshow, and a debounced input save that flushes on pagehide. Validate `app` and `version` in `deserializeAll`, and put the verify ticks in the export. Also call `navigator.storage.persist()` (PF-04). Effort M.
5. **Search breakages** (DS-01, CO-05, DA-01, CO-12, DA-10). The global `.search` rule (`base.css:857-867`) forces ManualSearch's wrapper to 36 px, so tapping an OCR hit opens the wrong page. DiagnoseSearch keys parts by `url+label` while parts.json has 379 duplicate rows. The Parts group therefore throws `each_key_duplicate` and disappears. `/parts#<no>` ignores the hash. Rename the wrapper class, dedupe the parts and handle the hash. Effort S.
6. **Handbook photos never work offline** (PF-02). The precache glob is `assets/figures/*.png`, so the 11 JPGs (1.7 MB) are neither precached nor cached at runtime. Effort S.

### P1: navigation model

1. **Back behaviour** (UX-02, CO-10, UX-03, CO-09, UX-08, VL-03, CO-06, CO-07, UX-04). Header back and swipe back push new history entries, and after a browser back the header points forward. System Back from a card lands on an empty Diagnose home, because typing keeps the URL clean. That is a documented decision (app-redesign.md:699), but it hurts the core loop. Map URLs drop the kind, so lamp 55 comes back as switch 55. Use `history.back()` when `tafh:prev` equals the target, skip backOverride on back_forward loads, and write `?q` with replaceState when results are committed. Effort M.

### P2: design system and UI consistency

1. **The header title overlaps the back label** (VP-03, AY-13). The cause is `.ct { max-width:220px }` in a `1fr auto 1fr` grid. Cap the title by the lead width or collapse the label to a chevron, and pass `short` titles for long handbook sections. Effort S.
2. **Finish the component migration** (DS-02, DS-07, DS-10, VP-09, VP-10, SV-16, DS-06, VP-14, DS-11, DS-15, DS-14, DS-20). Build the spec's `.btn` family, one search field, type tokens and a z-index scale. Stop WireChip from reusing the interactive `.chip` class. Move literal radii to tokens and wrap hovers in `@media (hover: hover)`. Effort L.
3. **Light theme and print** (DS-04, DS-08, AY-04, DS-05, DS-03, DS-09, AY-16). Use `--on-amber` on the primary button and `--amber-ink` for amber text at 13 sites. Make the global `.dmd` use `--dmd-ink` and `--dmd-dot`. Fix the print token specificity in the light theme. The positive swipe-to-fix action should not be red. Effort M.
4. **Tables, matrices and large screens** (VP-04, VP-12, VL-06, VL-07, VL-01, VL-04, VL-05, VL-08, VL-09, VL-10, VP-05, VP-06, VP-07, UX-15, VP-08). Put `nowrap` on code, pin and part cells, and show notes as a second row on phone. The desktop map side panel is a grid instead of a flex column (`PlayfieldMap.svelte:1823`), which clips the card. The glass controls cover the drawing from 1000 to 1366 px. Prose runs 114-184 characters per line, and "Appearance" truncates to "Appe". Effort M.
5. **Accessibility** (AY-01, AY-02, AY-05, AY-06, AY-07, AY-09, AY-10, AY-12, AY-11, AY-14, AY-15). The map is a 148-stop tab trap, and the skip link stays 1×1 px when focused. Focused controls hide under the Diagnose dock and the tab bar. The 38 setup inputs are all named "Set to", and matrix status is shown by colour only. Counts and empty states are not announced, and many targets are under the spec's own 44 px. Carried over from P2 item 3: `.field` borders measure 1.39:1 in dark and 1.47:1 in light against their background; give them a 3:1 boundary or write a spec §12 rule that documents why not. Effort M.

### P3: copy and terminology

 1. **One name per thing** (CP-01..CP-20, UX-06, UX-07, UX-10, CR-09). Pick one state vocabulary (Broken, Fault or Fixed), one code format per kind, one meaning for "Handbook", one verb per destination, one spelling standard (US or UK), one progress format and one date format. Fix the missing spaces before inline links on six pages, and the "p." label that prints a PDF index. Update the README, which says 56 pages in 10 sections against 64 today, and the CHANGELOG, which leaves out the redesign. Effort M.

### P4: code structure, data and tooling

 1. **Presentation helpers** (AR-05, SV-07, AR-16, AR-09, AR-12, AR-14, SV-12, CP-14). The code chip, kind line, wiring, page labels and map deep links are built in 7-8 places. Move them to lib and use them everywhere. Effort M.
 2. **Split PlayfieldMap** (AR-06, SV-08, SV-03). Extract zoom and gestures, calibration (lazy, only with `?calib=1`), the parts list and the card. Fix the `flushSync` TypeError on `/map?z=`. Effort L.
 3. **Kit data boundary** (AR-01, DA-02, AR-03, DA-05, DA-03, DA-04, DA-12, DA-07, DA-09, DA-16). The owner's coil-02 note sits inside the synced kit copy and will be lost on the next `sync-kit`. Translate the Swedish kit once at load, since coil 22's note leaks into the UI today. Resolve the conflicts over GI wire colours, the magnet fuse and the app101 battery. Add cross-source integrity tests. Effort M.
 4. **CI and tooling** (TT-01, TT-02, TT-04, TT-05, TT-07, TT-08, SV-19, TT-10, TT-11, TT-13). Gate deploys on check, svelte-check, lint, prettier and e2e, and add a `pull_request` trigger. Add a WebKit 390×844 project, fix the red motion test, replace the deprecated `z` import and normalise line endings. Two stale `astro preview` servers from 2026-09-25 hold ports 4321 and 4322, and local e2e silently reuses port 4321. Effort M.
 5. **Payload** (PF-05, SV-05, SV-10, SV-11, AR-07, AR-08, PF-06, PF-09, PF-10). Handbook sections serialise the TOC twice and hydrate a phone-hidden sidebar with `client:load`. A 57-59 KB data chunk loads for two label maps. About 230 KB of unused JSON and a 1.25 MB drawing are precached. Schematic pages fetch four full-resolution tiles. Effort M.

## Strengths worth keeping

- `src/lib/url.ts` builds every link. There are no hardcoded absolute paths, so BASE_PATH works everywhere.
- Thin `switch`, `lamp` and `coil` `[id].astro` shells sit over one ComponentPage layout.
- The tables are static-first, with small progressive enhancers instead of big islands.
- There is one BottomSheet, one Toast host, and one nav.ts source of truth for the tabs.
- The backup format in status-io.ts is pure, versioned and unit-tested.
- The matrix is a roving-tabindex grid, the layer buttons are labelled, and the dialog semantics are correct.
- The detailed design spec and task log made the review fast, and the e2e suite is broad at 318 tests.

## Resume

P0 (645d614), P1 (00c83ad), P2 item 1 (dc21002), P2 item 2 (c210aa5), P2 item 3 (1be60ff), P2 item 4 (62d17e0), P2 item 5 (623ab22), P3 item 1 (1a14a76), P4 item 1 (579d801), P4 item 2 (d3dcf87), P4 item 3 (9b853f7) and P4 item 4 are committed on main (see Progress at the end), which closes P2 and P3. Next and last is P4 item 5, payload (plan line 50; the plan items P4 1 to 5 are lines 46 to 50, one each): handbook sections serialise the TOC twice and hydrate a phone-hidden sidebar with client:load, a 57-59 KB data chunk loads for two label maps, about 230 KB of unused JSON and a 1.25 MB drawing are precached, schematic pages fetch four full-resolution tiles (PF-05, SV-05, SV-10, SV-11, AR-07, AR-08, PF-06, PF-09, PF-10); re-measure every number against the current build first, since P4 item 3 already removed three dead JSON copies from the precache. A stale astro preview of this repo (pid 13720) still holds port 4323; the Playwright webServer port 4321 is now guarded by tests/e2e/global-setup.ts. P4 item 4 gated deploys (deploy.yml: static, a three-project e2e matrix including phone-webkit, the Pages build with the link check, then deploy needing all three; pull_request trigger), added the WebKit 390x844 project with named gates, fixed the motion race (a DOMContentLoaded wait plus visible retries of Chrome-dropped transitions), normalised line endings (.gitattributes eol=lf, prettier --check clean), guarded port 4321 (global-setup compares the served sw.js with dist/sw.js), replaced the deprecated z import (0 astro check hints), made svelte-check a gate with 0 errors, and added axe over 26 routes plus link and workflow tests; the first ubuntu CI run has not happened, so open a pull request before merging to main or a red first run blocks every deploy.

## Appendix: every finding

One row per finding. Severity is the verifier's recalibrated value. Refuted and deliberate findings are listed at the end of each group for the record.

### Architecture and code structure (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| AR-04 | high | confirmed | Verify ticks are a second checklist system outside backup and Clear | src/lib/verify-store.ts |
| AR-01 | medium | confirmed | Owner correction lives inside the synced kit copy and will be reverted by sync-kit | src/data/kit/components.json (coils "02".note) |
| AR-02 | medium | partly | Last-writer-wins persistence silently loses fault marks across tabs | src/lib/model/status.svelte.ts:14-32 |
| AR-03 | medium | partly | Render-time exact-string translation lets Swedish leak into the UI | src/lib/data/en.ts (t = dict[s] ?? s) |
| AR-05 | medium | confirmed | Component code, kind line and wiring are derived in 7-8 places and have drifted | src/components/ComponentCard.svelte:33,37,40 |
| AR-06 | medium | partly | PlayfieldMap.svelte (1926 lines) mixes zoom, calibration, parts list and card rendering | src/components/PlayfieldMap.svelte:1-662 (script) |
| AR-07 | low | partly | A 59 KB dataset chunk is pulled into islands that only need constants | src/components/ComponentDetail.svelte:13 |
| AR-08 | low | partly | About 230 KB of unused JSON is precached by the service worker | astro.config.ts (workbox globPatterns 'data/*.json') |
| AR-09 | low | partly | Kind and layer vocabulary is scattered, with five labels for coils | src/lib/data/components.ts:38-42 (KIND_LABEL), LAYER_LABEL |
| AR-10 | low | partly | Storage access is split across 9 files in three styles, with key-name drift | src/components/PlayfieldMap.svelte:220,617,659 |
| AR-11 | low | confirmed | Types mirror the raw kit shape with an unvalidated cast and structural type guards | src/lib/data/components.ts:19,61-72 |
| AR-12 | low | confirmed | Manual page labels are hand-typed while helpers for them go unused | src/lib/pages.ts:24,44,49 |
| AR-13 | low | partly | Dead exports and stale comments | src/lib/pages.ts:13,19,44,49 |
| AR-14 | low | partly | The heading-index builder is copied three times | src/pages/setup.astro:10-25 |
| AR-15 | low | confirmed | CI does not gate on type-check, lint or e2e | .github/workflows/deploy.yml:27-29 |
| AR-16 | low | confirmed | Map deep links are built inline 7 times, and their action labels vary | src/lib/url.ts |
| AR-17 | low | partly | Breakpoints outside the spec, and matchMedia strings duplicated in JS | src/styles/base.css:293 |
| AR-18 | low | confirmed | The kit's Python prototype pipeline is synced into the repo but never run or documented | scripts/sync-kit.mjs:19 |
| AR-19 | low | confirmed | Shopping keys are serialized twice into island props on every page | src/layouts/Base.astro:49,163,175 |
| AR-20 | low | confirmed | base.css is a 1276-line monolith, and event names and types are untyped strings | src/styles/base.css:99-278,455-556,573,891-1113,1114-1220,1221 |

### Correctness and robustness (score 5/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| CO-01 | critical | confirmed | Diagnose home unreachable after any ?q= URL: Clear, Recent, Cancel and the tab all snap back | src/components/Diagnose.svelte:33-36 |
| CO-02 | critical | confirmed | Offline: every URL with a query string fails (Show on map, Results back link, tab links) | astro.config.ts:47-57 |
| CO-03 | high | confirmed | 'Replace everything' import wipes all statuses for any non-backup JSON | src/lib/status-io.ts:90-109 |
| CO-04 | high | confirmed | Lost updates: stores persist a stale in-memory snapshot (second tab, bfcache) | src/lib/model/status.svelte.ts:24-32 |
| CO-05 | high | confirmed | Diagnose search throws each_key_duplicate and drops the Parts group | src/components/DiagnoseSearch.svelte:212 |
| CO-06 | medium | confirmed | Map URL drops the component kind: lamp 55 comes back as switch 55 | src/components/PlayfieldMap.svelte:305-312 |
| CO-07 | medium | partly | Swipe-back leaves #main translated off-screen for a bfcache restore | src/motion.ts:150-158 |
| CO-08 | medium | confirmed | Recent flattens a pasted multi-line report; refilling shows junk tokens | src/lib/model/recent.svelte.ts:63 |
| CO-12 | medium | confirmed | Parts search results link to /parts#<no>, but the Parts page ignores the hash | src/components/DiagnoseSearch.svelte:150 |
| CO-09 | low | partly | System Back from a result card lands on an empty Diagnose home | src/components/Diagnose.svelte:38-48 |
| CO-10 | low | confirmed | Swipe-back pushes a history entry, so system Back returns to the dismissed page | src/motion.ts:153 |
| CO-11 | low | confirmed | Parser rejects trailing punctuation and common separators ('Check Switch 32.', '#32', '32-68') | src/lib/codes.ts:39-47 |
| CO-13 | low | partly | Backup omits Verify ticks; 'Clear all' leaves Verify, Recent, Viewed and Reading | src/lib/status-io.ts:29-42 |
| CO-14 | low | confirmed | Duplicate history timestamps crash the component page's hydration | src/lib/status-io.ts:60 |
| CO-15 | low | partly | Install button goes dead after the first dismissal | src/lib/install.ts:92-98 |
| CO-16 | low | confirmed | 'Check for updates' can report 'up to date' while a new worker is installing | src/pwa.ts:33-47 |
| CO-17 | low | confirmed | Unhandled promise rejection on every skipped view transition | src/layouts/Base.astro:108-111 |
| CO-18 | low | partly | Manual viewer shortcuts ignore modifier keys | src/components/PageViewer.svelte:81-91 |
| CO-19 | low | partly | Backup download revokes its blob URL synchronously | src/components/DeviceData.svelte:29-37 |
| CO-20 | low | confirmed | Some fetches have no error path; the ?q= decode can throw | src/components/PartsList.svelte:15-22 |

### Svelte 5 and Astro component quality (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| SV-01 | high | confirmed | Diagnose ?q= effect re-fills the input, so Clear, Cancel and backspace-to-empty stop working | src/components/Diagnose.svelte:33-35 |
| SV-02 | high | confirmed | Persisted runes stores have no cross-tab / storage-event sync; a second tab overwrites statuses | src/lib/model/status.svelte.ts:14 |
| SV-03 | medium | confirmed | flushSync inside the first-fit $effect throws an uncaught TypeError on /map?z= | src/components/PlayfieldMap.svelte:182-188 |
| SV-04 | medium | partly | DiagnoseSearch loader effect refetches datasets; three different fetch/error patterns across search islands | src/components/DiagnoseSearch.svelte:161-166 |
| SV-08 | medium | partly | PlayfieldMap is a 1926-line monolith that ships calibration tooling to end users | src/components/PlayfieldMap.svelte:128,135,216 |
| SV-05 | low | confirmed | Handbook section pages hydrate a phone-hidden TOC with client:load and serialize the full TOC twice (~130KB props) | src/pages/handbook/[section].astro:67 |
| SV-06 | low | confirmed | BottomSheet grabber: mouse drag snaps back because the click handler re-toggles after grabUp | src/components/BottomSheet.svelte:117 |
| SV-07 | low | partly | Code label, kind line, 'p. 2-N' page label and map link are re-derived in 4-7 places with drifting text | src/components/ComponentCard.svelte:117,140 |
| SV-09 | low | partly | $effect used as a mount hook in several islands; they re-run on unrelated state changes | src/components/Diagnose.svelte:33 |
| SV-10 | low | confirmed | Island props and hydration directives heavier than needed on every page | src/layouts/Base.astro:163,175 |
| SV-11 | low | confirmed | ComponentCard/ComponentDetail import the 57KB components chunk just for two label maps | src/components/ComponentCard.svelte |
| SV-12 | low | confirmed | Page frontmatter duplicates handbook heading-index and link logic that belongs in lib | src/pages/care.astro:10-24 |
| SV-13 | low | confirmed | Imperative DOM and untyped inline scripts beside Svelte; test instrumentation shipped to production | src/pages/tables.astro:143-180 |
| SV-14 | low | partly | Dead or unused props and bindings | src/components/Diagnose.svelte (prop `initial`) |
| SV-15 | low | partly | Stringly-typed tafh:* event bus split between window and document; toast can fire before its listener hydrates | src/components/Toast.svelte |
| SV-16 | low | confirmed | Search fields are inconsistent across islands (clear affordance, empty-state wording, placeholder style) | src/components/Diagnose.svelte:255 |
| SV-17 | low | partly | PageViewer window keyboard handler lacks a modifier guard, unlike PlayfieldMap | src/components/PageViewer.svelte (svelte:window onkeydown={onKey}) |
| SV-18 | low | partly | Inconsistent hydration-gating pattern for localStorage-backed UI | src/components/TabBadge.svelte |
| SV-19 | low | confirmed | Deprecated `z` import from astro:content produces all 16 astro check hints | src/content.config.ts:1 |
| SV-20 | low | confirmed | DeviceData revokes the export URL synchronously and leaves timers uncleared | src/components/DeviceData.svelte |

### Design system and CSS consistency (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| DS-01 | critical | confirmed | Global .search rule collapses ManualSearch: OCR results are hidden under the document list and taps open the wrong page | src/components/ManualSearch.svelte:65 |
| DS-12 | high | partly | Legacy table.t collapses on phones: notes wrap one word per line, pins break and columns are clipped | src/styles/base.css:404-422 |
| DS-02 | medium | confirmed | Button system split into four specs; the spec's .btn and its variants were never built | src/styles/base.css:332-367 |
| DS-03 | medium | confirmed | Print token resets do nothing in the light theme (specificity), and the top bar and controls still print | src/styles/base.css:1221-1276 |
| DS-04 | medium | confirmed | Primary button text fails AA in light mode because the --on-amber migration never landed | src/styles/base.css:351-356 |
| DS-05 | medium | confirmed | Two DMD implementations: the global .dmd ignores --dmd-ink and --dmd-dot and is dim in light mode | src/styles/base.css:386-401 |
| DS-06 | medium | confirmed | WireChip's .chip collides with the global filter chip: a non-interactive label looks and hovers like a button | src/components/WireChip.svelte:6,12-27 |
| DS-07 | medium | partly | Two type scales coexist: rem-based legacy pages and px-based redesigned pages, with no type tokens | src/styles/base.css:39-51,323,360,407,419,442 |
| DS-08 | medium | partly | Amber text uses --amber in 13 places instead of --amber-ink; fails AA in light mode | src/components/ManualSearch.svelte:135 |
| DS-09 | medium | confirmed | Swipe-to-fix pane is red with white text (2.5:1) for a positive action | src/components/ShoppingList.svelte:236-249 |
| DS-10 | medium | confirmed | Search fields differ between pages, and four controls are under 16px | src/pages/tables.astro:101 |
| DS-11 | medium | confirmed | No z-index scale: the toast sits exactly on top of the reader toolbar and over the map sheet | src/components/Toast.svelte:57-60 |
| DS-13 | low | confirmed | The map sheet's owner hint has a different style and drops the provenance tag | src/components/PlayfieldMap.svelte:817,820 |
| DS-14 | low | confirmed | Six :hover rules outside @media (hover: hover), despite the Phase 5 rule | src/components/Matrix.svelte:232 |
| DS-15 | low | confirmed | Radius tokens bypassed: 60 of 83 radii are literals, and --r-sm is never used | src/styles/base.css:398,703,755,778,796,824,862 |
| DS-16 | low | partly | Off-scale breakpoints 900 and 960; JS repeats the breakpoints as string literals | src/styles/base.css:293 |
| DS-17 | low | confirmed | Dead CSS, unused tokens and stale comments | src/styles/base.css:297,315,363,1234,1255,573 |
| DS-18 | low | confirmed | Global list inset is overridden to 0 in 8 files | src/styles/base.css:575-588,673-677 |
| DS-19 | low | confirmed | Light theme is written out twice in full; theme-color ignores the in-app theme choice | src/styles/tokens.css:153-197 |
| DS-20 | low | partly | Spacing and motion literals bypass the scale | src/components/ShoppingList.svelte:246,259 |

### Visual UI on phone (dark and light) (score 5/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| VP-01 | critical | confirmed | Handbook sections blow out to 670-720px wide and push the tab bar off-screen | src/pages/handbook/[section].astro:163-175 |
| VP-02 | high | confirmed | /coils overflows to 589px through .grid-2 and hides the tab bar | src/styles/base.css:288-300 |
| VP-03 | high | confirmed | Long header titles overlap the back label | src/styles/base.css:120-147 |
| VP-04 | high | confirmed | Component tables squeeze to unreadable columns on phone | src/styles/base.css:404-422 |
| VP-05 | medium | partly | The Broken checkbox is off-screen and far too small on lamps/coils | src/styles/base.css:558-566 |
| VP-06 | medium | partly | The large code badge wraps ('SOL' / '01') and spills out | src/styles/base.css:818-835 |
| VP-07 | medium | confirmed | The 'Appearance' row label is truncated to 'Appe' | src/components/WorkshopHub.svelte:254-257 |
| VP-08 | medium | confirmed | Double side gutter on the Tables and Workshop hubs | src/styles/base.css:575-590 |
| VP-09 | medium | confirmed | Three different search-field styles, one of them a field nested in a field | /tables (input.search h36 r10) |
| VP-10 | medium | confirmed | The type scale has sprawled past the spec's five steps | src/styles/base.css:322 (.small 0.85rem) |
| VP-12 | medium | confirmed | The switch and lamp matrices are hard to use on phone | src/components/Matrix.svelte:167 |
| VP-11 | low | partly | The header title and the H1 disagree on several routes | /switches@phone-dark (header vs 'Switch matrix' spec §9.6) |
| VP-13 | low | confirmed | Missing spaces before inline links | src/pages/switches.astro:46-47 |
| VP-14 | low | confirmed | Code chips are styled inconsistently | src/styles/base.css:818-835 |
| VP-15 | low | partly | Map chrome is ambiguous: two icons open the same sheet, and there is an unlabeled layer rail | /map@phone-dark |
| VP-16 | low | confirmed | Fuses and parts tables misalign across groups | /fuses@phone-light |
| VP-17 | low | partly | The Diagnose idle and result states have weak visuals | /diagnose@phone-dark |
| VP-18 | low | confirmed | IM Fell renders '1' like 'I' in numerals | /setup step numbers@phone-dark |
| VP-19 | low | refuted | Reader bar truncation and gaps | /handbook/quick reader bar@phone-dark |

### Visual UI on tablet and desktop (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| VL-01 | high | confirmed | The map side panel clips the selected card inside a nested scroller and leaves a dead band | src/components/PlayfieldMap.svelte:1823 |
| VL-02 | high | confirmed | /coils scrolls sideways at every width from 600 to 1366 | src/styles/base.css:293-300 |
| VL-03 | medium | partly | Sidebar sub-row clicks produce back links to unrelated tabs | src/motion.ts:35-42 |
| VL-04 | medium | confirmed | Map glass controls cover the drawing from 1000px to about 1366px | src/components/PlayfieldMap.svelte:1727-1735 |
| VL-05 | medium | confirmed | The manual viewer fits width only and nests a scroll inside the page scroll | src/components/PageViewer.svelte:47-51 |
| VL-06 | medium | confirmed | The switch and lamp matrices still scroll sideways on a 1440 desktop | src/pages/switches.astro |
| VL-07 | medium | confirmed | Solenoids tables break part codes mid-token at desktop width, and one column has no header | src/pages/coils.astro:25-37 |
| VL-08 | medium | confirmed | The Diagnose input stays docked to the bottom on desktop and takes about 19% of the viewport | src/components/Diagnose.svelte:540-549 |
| VL-09 | medium | confirmed | Prose runs to 114–184 characters per line on desktop | src/styles/base.css:86-93 |
| VL-10 | medium | confirmed | Tab roots and their pages use unrelated content widths | src/styles/base.css:876-879 |
| VL-11 | low | confirmed | The Handbook/Manuals/Parts switcher jumps between its three pages | src/components/DocSeg.astro:19 |
| VL-12 | low | partly | The desktop bar repeats the page title right above the h1, with different wording | src/styles/base.css:217-260 |
| VL-13 | low | confirmed | Inputs and controls stretch to the full column on detail and setup pages; Fuses tables don't line up | /setup@desktop-light (scratchpad/visual-large/img/desktop-light__setup.png) |
| VL-14 | low | confirmed | Hover styles differ between list rows, cells and the ReaderBar | src/styles/base.css:24-28 |
| VL-15 | low | partly | The ReaderBar floats over the handbook reading layout on desktop | src/components/ReaderBar.svelte:106-120 |
| VL-16 | low | confirmed | The last sidebar sub-rows fall below the fold on common laptop heights | src/styles/base.css:934-1110 |
| VL-18 | low | confirmed | Visible copy defects on large-screen pages | src/pages/coils.astro:14-15 |
| VL-17 | low | deliberate | Sidebar labels don't match the pages they open | src/lib/nav.ts:44-77 |

### UX flows and information architecture (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| UX-01 | high | confirmed | Diagnose field cannot be cleared after landing on a /?q= URL | src/components/Diagnose.svelte:33-36 |
| UX-02 | high | confirmed | Header back and swipe back push history instead of going back | src/layouts/Base.astro:191 |
| UX-03 | high | confirmed | Diagnose results are lost on browser back (the clean-URL decision hurts the core loop) | src/components/Diagnose.svelte:40-48 |
| UX-04 | medium | partly | Scan opened from a handbook section goes back to Manuals, and paging floods history | src/lib/nav-state.ts:63 |
| UX-06 | medium | confirmed | The same action has different labels and behaviours across card, detail and map | src/components/ComponentCard.svelte:126-142 |
| UX-08 | medium | confirmed | Cross-tab back label names the tab, not the page it goes to | src/motion.ts:71 |
| UX-10 | medium | confirmed | 'Handbook' names the tab, a subpage, a scanned document and the app | src/lib/nav.ts:57 |
| UX-11 | medium | partly | Global search is hidden behind a code field and the handbook body is not indexed | src/components/Diagnose.svelte:330 |
| UX-15 | medium | confirmed | Workshop 'Appearance' label truncated to 'Appe' | src/components/WorkshopHub.svelte:165 |
| UX-05 | low | partly | 'Show on map', mini-map and manual page shown for parts that are not on the map | src/components/ComponentCard.svelte:126-142 |
| UX-07 | low | partly | Status words split across Broken, Fault and Fixed, and Fixed has no undo | src/pages/switches.astro:59 |
| UX-13 | low | confirmed | Manual links from a component don't point to its callout | src/lib/url.ts manualHref(doc,page) |
| UX-14 | low | confirmed | First-run offline toast covers controls | src/pwa.ts:26 |
| UX-16 | low | partly | Unknown codes and ids give weak error states | /?q=ZZ99 @ phone-dark ux/b/05_zz99.png |
| UX-17 | low | confirmed | Fault marker on the map is faint | /map?layer=sw&id=32 @ phone-dark ux/g/06_map_fault.png |
| UX-09 | low | deliberate | Device data (backup and 'Clear all') is filed under Shopping list | src/lib/nav.ts:76 |
| UX-12 | low | deliberate | Map search icon and hamburger open the same sheet | src/pages/map.astro:8 |

### Accessibility (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| AY-03 | high | confirmed | Handbook sections and coils table force horizontal page scroll at phone widths | src/pages/handbook/[section].astro:163-168 |
| AY-01 | medium | partly | Map is a 148-stop tab trap for keyboard users; details sheet never reached or announced | src/components/PlayfieldMap.svelte:991-1010 |
| AY-02 | medium | confirmed | Focused controls hidden under sticky Diagnose dock and fixed tab bar | src/styles/base.css:8 |
| AY-04 | medium | confirmed | Light theme uses --amber (#c9520f) as text and a literal #1a0d05 on the primary button | src/styles/base.css:351-354 |
| AY-05 | medium | confirmed | Skip link stays 1x1 px and invisible when focused | src/layouts/Base.astro:138 |
| AY-06 | medium | confirmed | Links inside prose are distinguished by colour only | src/styles/base.css:20-28 |
| AY-07 | medium | confirmed | Matrix test status conveyed only by border colour and missing from accessible names | src/components/Matrix.svelte:97 |
| AY-09 | medium | confirmed | Result counts and empty states are not announced | src/components/Diagnose.svelte:131-137 |
| AY-10 | medium | confirmed | Setup guide: 38 inputs all named 'Set to', suggestion buttons named only by their value | src/components/SetupGuide.svelte:66-71 |
| AY-11 | medium | partly | Page viewer: unscrollable stage for keyboard, global single-key shortcuts, aria on href-less links | src/components/PageViewer.svelte:82-91 |
| AY-12 | medium | confirmed | Many touch targets below the spec's own 44 px rule | src/components/StatusRow.svelte |
| AY-13 | medium | confirmed | Top-bar back label collides with the centred title on phone | src/styles/base.css:120-146 |
| AY-08 | low | confirmed | Unused matrix cells are focusable links rendered at 0.45 opacity | src/components/Matrix.svelte:211 |
| AY-14 | low | confirmed | Handbook headings skip from h1 to h3; owner-note aside nested in article | src/lib/handbook/render.ts:57-58 |
| AY-15 | low | confirmed | Text-field focus is only a 1 px border colour change | src/styles/base.css:376-379 |
| AY-16 | low | confirmed | Near-miss contrast: tinted chips, hints, placeholder, faint on raised cells, segment thumb | src/styles/tokens.css |
| AY-17 | low | partly | Minor semantics: empty table headers, duplicated figure text, theme control naming | /coils@phone-dark |

### Copy, terminology and naming consistency (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| CP-01 | medium | confirmed | Words run together before inline links on six pages | src/pages/care.astro:43-46 |
| CP-02 | medium | confirmed | Diagnose search labels manual pages by PDF index but prints 'p.' | src/components/DiagnoseSearch.svelte:127 |
| CP-03 | medium | partly | One component appears under four or five different codes | src/lib/shopping.ts:32-34 |
| CP-04 | medium | confirmed | Table pages carry two or three names, and copy names pages that the nav never shows | src/pages/switches.astro:26-27 |
| CP-11 | medium | partly | Backup wording and scope are inconsistent | src/pages/workshop.astro:39,45 |
| CP-05 | low | confirmed | 'Broken', 'Fault' and 'Fixed' name one state | src/pages/switches.astro:59,80 |
| CP-06 | low | partly | 'Handbook' means four different things | src/lib/nav.ts:57-66 |
| CP-07 | low | confirmed | README describes the app before the redesign | README.md:6 |
| CP-08 | low | confirmed | CHANGELOG leaves out the 12-phase redesign and keeps stale nav claims | CHANGELOG.md:3-26 |
| CP-09 | low | partly | Wire colours are abbreviated for solenoids and spelled out elsewhere | src/pages/coils.astro:56,100,136 |
| CP-10 | low | confirmed | Developer notes appear in owner-facing copy | src/pages/verify.astro:42-43 |
| CP-12 | low | partly | Same destination, different button verbs | src/components/Matrix.svelte:157-158 |
| CP-13 | low | partly | The Care row says 'Next:' but always shows the first interval | src/pages/workshop.astro:16 |
| CP-14 | low | confirmed | The kind or location sub-line is worded four ways | src/layouts/ComponentPage.astro:32-38 |
| CP-15 | low | confirmed | '1 pages' plural bug and two names for the WPC document | src/components/ManualSearch.svelte:80,85 |
| CP-16 | low | confirmed | British and US spelling are mixed | src/components/Diagnose.svelte:280 |
| CP-17 | low | confirmed | Progress counts appear as both 'n / m' and 'n of m' | src/components/SetupGuide.svelte:31-32,42 |
| CP-18 | low | confirmed | Heading case and '&' versus 'and' drift | src/pages/coils.astro:23,83,119 |
| CP-19 | low | confirmed | Search placeholders and no-result messages follow no pattern | src/components/PlayfieldMap.svelte:848-849,859 |
| CP-20 | low | partly | Most routes fall back to the generic meta description | src/layouts/Base.astro:37 |

### Data integrity and cross-source consistency (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| DA-01 | high | confirmed | Diagnose search Parts group crashes on duplicate part rows | src/components/DiagnoseSearch.svelte:155 |
| DA-02 | medium | confirmed | sync-kit would overwrite newer in-repo data and docs; public/data has already drifted | scripts/sync-kit.mjs |
| DA-03 | medium | partly | GI wire colours contradict the fuse list's GI numbering | src/content/handbook/ops002.md:55-58 |
| DA-04 | medium | partly | The magnet fuse is given three different answers | tools/build_data.py:268-285 |
| DA-05 | medium | confirmed | Swedish strings leak into the English UI | tools/build_data.py:277 |
| DA-07 | medium | confirmed | Menu-map links P.1–P.8 fall back to /handbook, and the test cannot see it | src/content/handbook/ops017.md:9 |
| DA-12 | medium | confirmed | app101 contradicts the owner notes on batteries and board location | src/content/handbook/app101.md:11 |
| DA-16 | medium | partly | Integrity tests cover positions but not cross-source consistency | tests/unit/positions.test.ts |
| DA-06 | low | confirmed | Wire colours and fuse strings use mixed formats | src/pages/coils.astro:100 |
| DA-08 | low | partly | 'Show on map' is offered for 22 components that have no map position | src/components/ComponentCard.svelte:139 |
| DA-09 | low | confirmed | Fuse id '—' is used three times, producing duplicate HTML ids and a wrong deep link | src/pages/fuses.astro:38 |
| DA-10 | low | confirmed | parts#<no> deep links from search are ignored | src/components/DiagnoseSearch.svelte:155 |
| DA-11 | low | confirmed | Orphaned assets and unused data files are precached by the service worker | astro.config.ts:49-57 |
| DA-13 | low | partly | Flasher count is attributed to two different sources | src/pages/coils.astro:16 |
| DA-14 | low | confirmed | Component id prefixes differ across views | src/lib/shopping.ts:32 |
| DA-15 | low | confirmed | The data pipeline cannot be reproduced from the repo | tools/build_data.py:268-314 |

### Performance, PWA and offline (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| PF-01 | critical | confirmed | Offline, every URL with a query string opens the browser's error page, including tab and back links the app creates | astro.config.ts:47 |
| PF-02 | high | confirmed | Handbook photos (11 JPGs) never work offline, even after viewing them online | astro.config.ts:53 |
| PF-04 | medium | confirmed | Owner data sits in best-effort storage: navigator.storage.persist() is never called | src/lib/model/status.svelte.ts:28 |
| PF-05 | medium | partly | Handbook sections ship the full contents list twice, and phones hydrate a hidden sidebar | src/pages/handbook/[section].astro:67 |
| PF-06 | medium | confirmed | Schematic pages download four full-resolution tiles and then show only the overview | src/components/PageViewer.svelte:37 |
| PF-07 | low | partly | Precache is 85% HTML and is mostly downloaded again on every deploy | astro.config.ts:49-55 |
| PF-08 | low | confirmed | The first tap on a Map marker takes 328 ms with the CPU slowed 4x | src/components/PlayfieldMap.svelte |
| PF-09 | low | confirmed | Unused files are precached: a 1.25 MB drawing and three JSON files | public/assets/figures/7696d0a6-e288-4e02-941f-47e792fd01e6.png |
| PF-10 | low | confirmed | The header logo is 106 KB at 800×406 and downloads on phones, where it is hidden | src/layouts/Base.astro:141-147 |
| PF-11 | low | confirmed | The scan-not-cached state still shows a broken image, an empty frame and zoom buttons | src/components/PageViewer.svelte:181-195 |
| PF-12 | low | confirmed | Offline, unknown routes open the browser error page even though 404.html is precached | astro.config.ts:48 |
| PF-13 | low | confirmed | Once opened, a scan is never replaced: cache-first for a year under unversioned file names | astro.config.ts:58-66 |
| PF-14 | low | confirmed | Manifest and icon polish: maskable art goes past the safe zone; no id, shortcuts or screenshots | astro.config.ts:25-45 |
| PF-03 | low | deliberate | Scans the user has not opened cannot be saved ahead of time for offline use | src/pwa.ts:26 |

### Tests, CI and tooling (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| TT-01 | high | confirmed | CI deploys to production after running only vitest and the build | .github/workflows/deploy.yml:3-6 |
| TT-03 | high | confirmed | 'Replace everything' import of a non-backup JSON file wipes all statuses, and no test covers it | src/lib/model/status.svelte.ts:91-93 |
| TT-02 | medium | confirmed | Svelte components are never type-checked; svelte-check finds 7 errors that `pnpm check` misses | package.json:11 |
| TT-04 | medium | confirmed | E2E suite is red: the phone-dark push-transition test fails even with one worker | tests/e2e/motion.spec.ts:24-40 |
| TT-05 | medium | partly | The owner's phone (iPhone/WebKit, 390x844) is not in the test matrix | playwright.config.ts:17 |
| TT-06 | medium | confirmed | Printed-page 'Go to page' accepts labels out of range and lands on the wrong page; pdfPageFromLabel has no test | src/lib/pages.ts:36-41 |
| TT-08 | medium | confirmed | Local e2e silently reuses whatever server is already on port 4321 | playwright.config.ts:4 |
| TT-09 | medium | confirmed | Untested pure logic: base-path URLs, the legacy status key, storage loaders | src/lib/url.ts:2-7 |
| TT-07 | low | confirmed | 5 source files committed with CRLF or mixed line endings; prettier --check fails on 8 files | src/pages/404.astro |
| TT-10 | low | confirmed | The 16 astro check hints are all deprecated `z` from astro:content | src/content.config.ts:1 |
| TT-11 | low | confirmed | Fixed waits in e2e, including a real 4.5 s sleep | tests/e2e/pwa.spec.ts:24 |
| TT-12 | low | confirmed | Duplicated e2e helpers and overlapping tests | tests/e2e/diagnose.spec.ts:8 |
| TT-13 | low | confirmed | No automated accessibility scan and no link-check guard | package.json:28-45 |
| TT-14 | low | confirmed | The Docker and nginx deploy path is untested and has cache and context problems | README.md:118-120 |
| TT-15 | low | confirmed | Dependency and tooling hygiene: supply-chain quarantine turned off, unpinned Python, stale docs | pnpm-workspace.yaml:4-5 |

### Completeness critic (cross-cutting) (score 6/10)

| ID | Sev | Verdict | Finding | Where |
| --- | --- | --- | --- | --- |
| CR-01 | high | confirmed | Typed notes and setup values are lost when leaving with system Back | src/components/StatusRow.svelte:38-39 |
| CR-02 | medium | partly | Any input with a digit goes to code mode, so indexed items are 'Not recognised' | src/components/Diagnose.svelte:60-62 |
| CR-08 | medium | partly | Phone landscape leaves about 190 px for content; ReaderBar covers text | src/components/Diagnose.svelte:540-549 |
| CR-03 | low | partly | Opening a component from another tab moves the highlight to Tables and rewrites that tab's memory | src/motion.ts:28-29 |
| CR-05 | low | partly | How-to-test service notes are buried at the bottom of detail pages and missing elsewhere | src/layouts/ComponentPage.astro:69-106,129-142 |
| CR-06 | low | partly | Unused matrix positions are treated as real switches | src/lib/shared-cause.ts:51 |
| CR-09 | low | partly | Dates use three formats, some without a year or in UTC; service log capped at 10 | src/lib/status-io.ts:3 |
| CR-10 | low | partly | Share/copy implemented four different ways; Diagnose share swallows errors | src/components/Diagnose.svelte:180-190 |
| CR-11 | low | confirmed | Recent 'Clear' wipes history in one tap, unlike arm-to-confirm elsewhere | src/components/Diagnose.svelte:227 |
| CR-13 | low | partly | Workshop pull-to-refresh competes with the browser's native pull-to-refresh | src/pages/workshop.astro:50-92 |
| CR-14 | low | partly | Broken checkbox on tables clears an existing OK status | src/lib/fault-check.ts:12-20 |
| CR-15 | low | confirmed | Handbook images lack intrinsic size, so the page shifts after load | /handbook/appendix@phone (scratchpad/completeness/anchor2.mjs) |
| CR-04 | low | deliberate | Phone map sheet cannot set status; desktop side panel can | src/components/PlayfieldMap.svelte:754-829 |
| CR-07 | low | deliberate | Care checklist is one-shot: ticks never expire and unticking erases the date | src/data/care.ts:1-4,13-14 |
| CR-12 | low | deliberate | Text-size preference applies only to the handbook reader | src/components/ReaderBar.svelte:32-49 |

## Progress

P0 was fixed by workflow wf_b1e7e918-802 and re-verified by wf_622399b3-62b, both in session 892cf09d. Their journals hold every agent's full report. The change set is 37 files against 4e38085. It was committed to main as 645d614 and pushed on 2026-09-29.

### P0 status per item

- **Item 1, Diagnose `?q` (CO-01, SV-01, UX-01): fixed.** Diagnose.svelte reads `?q` once in onMount. Re-tapping the current Diagnose tab now returns to the home: Base.astro's reselect handler dispatches `tafh:reselect`, and Diagnose clears on it. The tests are in diagnose.spec.ts.
- **Items 2 and 6, offline (CO-02, PF-01, PF-12, PF-02): fixed.** Workbox sets `ignoreURLParametersMatching: [/.*/]`, and the figures glob includes jpg and jpeg. A NetworkOnly route with a precache fallback serves the branded 404 offline. `navigateFallback` stays null, and a comment in astro.config.ts says why. `src/lib/precache.ts` rekeys the manifest so the home works under a sub-path. The offline test in pwa.spec uses relative paths and passes under `BASE_PATH=/valvet/`. Two small gaps remain. Offline, `index.html` and `map.html` URLs get the 404 page, but no link uses them. The offline 404 answers with status 200.
- **Item 3, layout (VP-01, VP-02, VL-02, AY-03, DS-12): fixed, DS-12 partly by design.** `.hb`, `.grid-2` and ComponentCard's `.comp` use `minmax(0,1fr)`. Links in `.prose` break anywhere. SetupGuide's long value buttons wrap, and the StatusRow buttons fit at 320 px. layout-overflow.spec sweeps every route and the Diagnose and map result states. It runs at each project's width and at 320 and 360 px on phone, and checks /coils from 600 to 1366 px. The rest of DS-12, nowrap cells and notes as a second row, is P2 item 11.
- **Item 5, search (DS-01, CO-05, DA-01, CO-12, DA-10): fixed.** ManualSearch's wrapper is now `.msearch`. DiagnoseSearch dedupes parts by `no` and keys every hit by an id that is unique by construction. The parts hit no longer shows `×qty`, because qty is per assembly. PartsList reveals, scrolls to and highlights `/parts#<no>` on load and on hashchange. It ignores hashes that are not parts, such as `#main`, and strips the hash once the field is edited.
- **Item 4, storage (CR-01, CO-04, SV-02, AR-02, CO-03, TT-03, AR-04, CO-13, PF-04): fixed.** The new `src/lib/storage.ts` does a read-modify-write per entry. Saves are debounced and flush on pagehide and visibilitychange. The stores resync on storage, pageshow and visible. A throwing setItem falls back to an in-memory copy, and `persist()` is asked after the first user write. Clear and replace bump a per-key counter in `tafh:reset`, so another tab drops edits it queued before the reset. Backup v2 carries the verify ticks. deserializeAll refuses foreign, newer, malformed and empty files and gives the reason. Replace asks for a second tap when it would drop entries. Clear all also empties Recent, Recently viewed and Continue reading. verify-store.ts became `model/verify.svelte.ts`. Not done: CO-14, duplicate history timestamps.

### Final verification (default base, fresh build)

| Check | Baseline | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | 7 errors | the same 7 |
| pnpm lint, prettier on changed files | clean | clean |
| vitest | 57/57 | 120/120 |
| e2e phone-dark | 315/318 across both | 271 passed |
| e2e desktop-light | | 232 passed, 39 phone-only skips |
| pwa.spec offline test under /valvet/ | fails | passes |

### P1 status (back behaviour, one item: UX-02, CO-10, UX-03, CO-09, UX-08, VL-03, CO-06, CO-07, UX-04)

P1 was designed, critiqued, implemented, reviewed by two lenses, fixed, re-checked and put through the gauntlet by workflow wf_43454508-090 (session 892cf09d, 2026-09-29 to 2026-09-30). Every finding is marked fixed by the dynamic reviewer, the static reviewer and the re-check. The change set is 18 files against 645d614, committed on main on 2026-09-30. The design is `p1-design-final.md` in that session's scratchpad, and the rules it settled are the 2026-09-29 bullets of app-redesign.md, Phase 12.

- **Header back and swipe back (UX-02, CO-10).** Both go through one guarded `goBack`. It calls `history.back()` when the previous entry is the target, found through the Navigation API where it exists and otherwise through a `from` stamp carried in `history.state`, and it uses `location.replace` otherwise, so a cold deep link never leaves the app. A double activation cannot walk two entries.
- **Back link after a traversal (UX-04 and the header pointing forward).** `resolveBack` in nav-state.ts decides the link once per load and stores it in `history.state`. `backOverride` now needs a fresh (10 s), same-origin `tafh:prev`, and only a cross-tab or push-down move; `depthOf` fixes the depth that made tab roots collide with nav keys. Labels come from `body[data-view]`, then `html[data-label]`, then the tab label. Sidebar links keep the static parent and get the tab cross-fade (VL-03). Manual paging (arrows, Go to, Prev/Next, same-doc TOC rows) replaces the entry instead of pushing.
- **Diagnose `?q` (UX-03, CO-09).** A commit (Enter, Diagnose, blur, a link followed from the view, a Recent row, or `?q` on load) writes `?q` with replaceState. Edits after a commit follow 250 ms after the last key, or at once when the page is hidden or left. That flush is skipped while the page enters the back/forward cache and runs on the restore instead, because a replaceState inside a persisted pagehide makes Chromium evict the page (the re-check found this regression from the fix round, fixed afterwards in this session with a test in back.spec). Clear, Cancel, Recent, reselect and emptying the field return to a clean `/`. A reload inside the 250 ms still loads the query before the edit; that limit is documented and accepted.
- **Map ids (CO-06).** The map writes `id=kind:id` and `parseMapId` reads it; the link builders in url.ts stay bare, and bare ids in old links still resolve. lamp 55 survives a layer toggle and a reload.
- **bfcache restore (CO-07).** A persisted pageshow resets the swipe transform and re-points the tabs. touchcancel springs back, and swipe is off in iOS Safari tabs. Verified only with a synthetic persisted pageshow, because Playwright's Chromium runs without bfcache.

Deviations from the design, each checked by a reviewer: map.spec:127 keeps HEAD's `/id=32/`, because a bare id is not rewritten on load; three P0 Diagnose tests reopen `/` instead of reloading a committed `?q`; motion.spec's "each tab keeps its stack" waits for hydration (it was failing 9 of 12 runs at the P0 snapshot); Base.astro's pagereveal uses one promise chain, so an aborted transition no longer leaves an unhandled rejection.

Leftovers, none blocking: the swipe-back fade is aborted in phone emulation ("Viewport size changed"), so a real Android device should confirm it plays; `from` is inferred from `document.referrer` without the Navigation API, which a tab with unrelated earlier history could get wrong; `leavesHere` ignores SVG links; other e2e tests that click right after a cross-document navigation may share the hydration race that was hardened in motion.spec.

### P1 verification (default base, fresh build)

| Check | P0 | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | 7 errors | the same 7 |
| pnpm lint, prettier on changed files | clean | clean (app-redesign.md was not prettier-clean at HEAD either) |
| vitest | 120/120 | 140/140 |
| e2e phone-dark | 271 passed | 295 passed, 1 skipped (workflow gauntlet) |
| e2e desktop-light | 232 passed, 39 skipped | 253 passed, 43 skipped (workflow gauntlet) |
| full suite after the bfcache flush fix | | vitest 140/140; phone-dark 296 passed, 1 skipped, twice in a row (a first run exited 1 with its summary lost to an output filter); desktop-light 254 passed, 43 skipped |

### P2 item 1 status (header title and back label: VP-03, AY-13), commit dc21002

- Under 1280 px the header grid is `minmax(var(--touch), 1fr) minmax(0, auto) minmax(var(--touch), 1fr)`: the title takes what it needs, the two side columns share the rest and never go below one touch target. `.back` wraps and clips (`flex-wrap: wrap`, `overflow: clip` under `@supports`, `hidden` otherwise), the chevron is padded to a `--touch` line and the label line is `--touch` tall, so a label that does not fit wraps out of the 44 px box and only the chevron shows. The label stays in the DOM and remains the accessible name.
- Base.astro mirrors the collapsed state into `data-bare` on the link (on load and through a ResizeObserver) so focus and hover styling can follow it.
- Short titles: `Section.short` for nine handbook sections (Quick reference, Rules, Assembly, Menus, Presets, Adjustments, Error codes, Maintenance, Appendix) and "Fuses" for /fuses. `html[data-label]` is `short ?? heading`, so the next page's back label reads the short. On a direct load the header is pixel-identical from 600 to 1440; a page opened from one of those ten pages reads the short as its back label at every width (accepted).
- New tests/e2e/header.spec.ts sweeps the routes at 320, 360 and the project width: no a.back and h1.ct intersection, accessible name kept, desktop checks. Spec §6.5 records the title rule and the back-link rule.
- Deviation: an agent in the workflow committed and pushed dc21002 itself, against the tree rule given to every agent. The commit is complete (8 files, proper trailer) and matches the standing "commit and push" instruction, so it stands; the next workflow prompt repeats the rule more firmly.
- Open content choice: shorts for the 28 /coil pages, /setup ("Setup") and /shopping ("Shopping") would keep the label visible at 320 on 30 of the 37 routes that collapse today. Not done; decide when the copy pass (P3) runs.
- Known flaky test: tests/e2e/back.spec.ts:672 (swipe back "traverses to the entry before, and only fades") failed once in the gauntlet and passed 3/3 alone; its 5 s poll for the fade motion type is timing-dependent.

### P2 item 1 verification (default base, fresh build)

| Check | P1 | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | the same 7 | the same 7 |
| pnpm lint, prettier | clean | clean (prettier flags only app-redesign.md and app-redesign-spec.md, pre-existing) |
| vitest | 140/140 | 140/140 |
| pnpm build | 349 pages | 349 pages |
| e2e phone-dark | 296 passed, 1 skipped | 331 passed, 1 failed (back.spec:672, flaky), 2 skipped |
| e2e desktop-light | 254 passed, 43 skipped | 256 passed, 78 skipped |

### P2 item 2 status (component migration: DS-02, DS-07, DS-10, VP-09, VP-10, SV-16, DS-06, VP-14, DS-11, DS-15, DS-14, DS-20)

- Tokens (src/styles/tokens.css, CRLF): 14 type tokens `--t-*` as font shorthands (t-lt 34/41 and t-title 22/28 Fell, t-name 20/24, t-h1-wide 24/30, t-head 600 17/22, t-body 17/24 unused since body stays 16, t-callout 16/21, t-sub 15/20, t-foot 13/18, t-cap 12/16, t-tab 500 11/13, t-mono, t-code 14/18, t-code-lg 22/26); a stacking scale `--z-lift-1..4` 1-4, `--z-dock` 5, `--z-ptr` 15, `--z-topbar` 20, `--z-map-controls` 25, `--z-peek` 28, `--z-shell` 30, `--z-toolbar` 32, `--z-toast` 40, `--z-modal` 60 (the toast stays under a modal sheet, which makes it inert); radius tokens `--r-btn` 12, `--r-chip` 16, `--r-track` 9, `--r-thumb` 7, `--r-wire` 5, `--r-grab` 3, `--r-code-lg` 8, `--r-full`; `--dur-0` 150 ms.
- base.css: the `.btn` family (gray base on `--sunk`, primary with `--on-amber` text, tinted, gray, plain, `sm` 36 tall with a `::after` that keeps a 44 hit area, `small` kept as an alias, mono, `aria-pressed`, disabled; hover inside the media query). One `.search`: a 44 box with a 4 px transparent border around a 36 painted pill of radius 10, 16/21 text (the spec's 15/20 is overridden so iOS does not zoom; logged). `.srch` wraps a field and a "Clear search" `.ibtn`. `.field` 16/21. `.wire` for wire swatches. `.code`/`.code.lg` on tokens. `.t-*` utilities. Every radius, z-index and hover in src/styles on the rules above.
- Islands: new src/components/SearchField.svelte (HandbookToc, ManualSearch, PartsList, PlayfieldMap); tables.astro writes the same markup by hand. Empty states read "No {things} match “q”." everywhere. WireChip renders `span.wire`. `btn small` became `btn sm`; local `.btn` copies in Diagnose, ComponentCard, ComponentDetail and Matrix are gone. Every z-index is a token. `--toast-lift` raises the toast above the reader toolbar (`:root:has(nav.rbar)`, 62 px), the map sheet (detent plus safe-bot, set per detent change) and the Diagnose dock (fix round). PlayfieldMap's header class is `.t-name`; its list header is `h3.lh`. The swipe spring-back runs on `--dur-3` (300 ms, was 250).
- Tests: tests/unit/design-system.test.ts lints the sources (no bare z-index, every `:hover` inside `@media (hover: hover)`, rem/em sizes only on an allow-list, `--z-*` in order, radii on tokens, every `--z-*` used, the classes the islands depend on exist). tests/e2e/design-system.spec.ts: `.btn.sm` hit area, the Go dialog button, the toast above the reader bar, the map sheet (with a 34 px safe-bot guard) and the Diagnose dock, every visible input at 16 px or more on 11 routes, search structure and clear behaviour, the wire swatch. hubs.spec and pwa.spec follow the renames.
- Deviations: Diagnose's DMD field is not a SearchField (spec §9.1 keeps it); `.hub > .search` and `.btn.small` stay as unused aliases (drop in a later sweep, with the unit test's class list); the map peek title truncates about 2 characters earlier at 320 because the spec's `.code.lg` chip is 40 tall; the handbook section summary keeps Fell 400.
- Reviews: dynamic pass with 3 minor, static fix_needed with 6 minor; the fix round fixed all but one and rejected the claim that safe-bot is counted twice in the map lift (the sheet's height includes it; a guard test proves the 10 px gap at a 34 px inset); the recheck passed. All 12 IDs marked fixed by both reviewers and the recheck.
- Environment: a locked worktree from another session sits at .claude/worktrees/installed-leds (branch worktree-installed-leds, base 8b90d85); bare `pnpm lint` walks into its dist/ and .astro/ and exits 1 with 1206 errors that are not ours. `pnpm exec eslint . --ignore-pattern '.claude/**'` is clean. A permanent fix is `.claude/**` in the eslint.config ignores, as its own change.

### P2 item 2 verification (default base, fresh build)

| Check | P2 item 1 | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | the same 7 | the same 7 (line numbers shifted by 1-2) |
| pnpm lint | clean | clean when scoped past the foreign worktree (see above) |
| prettier | two .claude md files flagged (pre-existing) | the same two, plus tokens.css unless `--end-of-line crlf` |
| vitest | 140/140 | 148/148 |
| pnpm build | 349 pages | 349 pages |
| e2e phone-dark | 331 passed, 1 flaky, 2 skipped | 363 passed, 3 skipped, back.spec:672 flaky once and 3/3 alone |
| e2e desktop-light | 256 passed, 78 skipped | 287 passed, 80 skipped |

### P2 item 3 status (light theme and print: DS-04, DS-08, AY-04, DS-05, DS-03, DS-09, AY-16)

- Tokens (src/styles/tokens.css, CRLF): the light inks were darkened to pass AA on their surfaces (`--amber-ink`/`--amber-fill` #9e4009, `--ok` #256738, `--warn` #7a5505, `--bad` #ab2e27, `--brass` #70552b, `--faint` #645c6c). The dark `--faint` (#857d8d) and `--brass` (#b08d57) are restored as border/decoration tokens and got text twins: `--faint-ink` (dark #918997, light and print #645c6c) used only by the `.field`/`.search` placeholders and the Matrix unused-cell id, `--brass-ink` (dark #b8955f, light and print #70552b) used only by `.hint strong` and the SetupGuide step number. New `--seg-edge`. The print block moved to the end of tokens.css and is written for `:root, :root[data-theme='light'], :root:not([data-theme='dark'])`, so it wins in both themes without `!important`; the two light blocks stay identical (46 declarations each).
- base.css: the print block holds no tokens; it hides the chrome and controls (tab bar, top bar, nav.rbar, .tlink, .hb .side, button.lrow, .pgno; a.lrow content links still print) and prints the real h1 on large-title pages. `.dmd` reads `--dmd-ink`/`--dmd-dot`/`--dmd-well` with a 6 px glow. Ten `color: var(--amber)` text sites moved to `--amber-ink`. Light `--bar` opacity .84 to .94 so the glass bars keep 4.5:1 over scrolled content.
- Islands: PlayfieldMap gets a `--k-ink` twin for the switch-layer text, the selected marker label sits on an opaque `--surface` chip, and the map-list pills paint `--pill-tint` over `--cell` in every row. Matrix unused cells are grey instead of dimmed and the matrix has its own print block for A4. ShoppingList's swipe pane is `--ok` with `--on-amber` text and the label at the far edge. Diagnose's well uses `--dmd-dot` and the placeholder sits at .7 opacity.
- Tests: tests/e2e/contrast.spec.ts (new) sweeps 15 route states in both themes for AA on composited backgrounds (flat linear-gradient layers included), checks print on 8 routes against a HIDDEN list, checks the A4 fit of /switches and /lamps, and on the map route marks switches 32 and 33 Fault and hovers row 33 on desktop. shopping.spec.ts covers the swipe pane; map.spec.ts reads `--amber-ink` from the page. Unit tests (g)-(l): no `color: var(--amber)` outside an allow-list (custom-property chains included), the DMD tokens, the print rule shape, identical light blocks, the pinned dark tokens with the `--brass-ink` contrast, and the twins' usage lists.
- Deviations and open points: DS-04 (`.btn.primary`) was already fixed by P2 item 2 and was only verified. Light `--brass` is #70552b (HEAD had #7d6033), so light borders are a shade darker than before. The contrast sweep composites only DOM-ancestor backgrounds; the dark tab labels over scrolled content under the glass bar (about 3.2:1) are not covered. The A4 fit is measured at Chrome's default margins. The `.field` border (1.39 dark, 1.47 light) is deferred to P2 item 5 and recorded in app-redesign.md.
- Reviews: dynamic fix_needed with 1 major and 5 minor, static pass; the fix round fixed 9 of 10; the recheck came back fix_needed with 4 minor; a second fix round (two agents) fixed the three actionable ones and left the `.field` border to item 5 by design. All 7 IDs marked fixed.

### P2 item 3 verification (default base, fresh build)

| Check | P2 item 2 | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | the same 7 | the same 7 |
| pnpm lint | clean when scoped past the foreign worktree | clean when scoped past the foreign worktree |
| prettier | the same two md files, tokens.css needs `--end-of-line crlf` | the same two md files; tokens.css, map.spec.ts and diagnose.spec.ts clean with `--end-of-line crlf` |
| vitest | 148/148 | 154/154 |
| pnpm build | 349 pages | 349 pages |
| e2e phone-dark | 363 passed, 3 skipped | 413 passed, 3 skipped |
| e2e desktop-light | 287 passed, 80 skipped | 336 passed, 80 skipped |

### P2 item 4 status (tables, matrices and large screens: VP-04, VP-12, VL-06, VL-07, VL-01, VL-04, VL-05, VL-08, VL-09, VL-10, VP-05, VP-06, VP-07, UX-15, VP-08)

- Widths and measure (spec §3.1, new): one content column `--content-w` (1120) for every tab root and page; `main.wide` and the `wide` prop are gone (Base.astro, ComponentPage.astro, the table and manual pages). Hubs are a start-aligned `--hub-w` (640) column with one gutter. `--measure` (52ch, about 60-80 characters in the body face) applies to text blocks only (`.prose` paragraphs, `.notes p`, `.wrap > p`, `.prov`, `.panel > p`, `.gf`, ComponentDetail `.gf`, SetupGuide paragraphs and step names), never to the column.
- Tables (spec §8.9, new): codes never break (`nowrap` on mono cells and `.code`; code phrases through the new src/components/Phrase.astro with nowrap `.tok` tokens); every column has a header (the solenoid Location header is sr-only); the Broken tick is a 44 x 44 label filling its cell; from 600 the id and tick columns stay pinned inside `.scroll-x`; under 600 the switch, lamp and solenoid tables become two-line rows with explicit ARIA roles (id and tick on the first line, the note on the second, empty pairs hidden), so no table scrolls sideways at 320. Fuses stays a plain table by decision (short codes). The flipper/GI pair is a `.pair` grid; `.grid-2` is left unused in base.css.
- Matrices (spec §9.6): fit the column from 1000 (table-layout fixed, wrapping names and wire labels, row-header pins as nowrap tokens); 600-999 scroll under a pinned row-header column; on the phone id-only cells of at least 24 x 44 with the colour swatch and the `row ↓` hint; a keyboard selection (`:focus-visible`) brings the card into view.
- Map from 1000 (spec §6.6, §7.4, §7.7): the side panel is one scroll column the height of the stage on `--ground` (documented decision), each selection scrolls it to the top; the glass floats only where the measured side gutter is at least 184 and the stage at least 350 tall, otherwise the layers become panel toggles and the legend a panel hint; the fit clears the control column and the readout. The handbook embed is unchanged.
- Manual viewer (spec §9.12): Fit width and Fit page (fit page is the default from 1000, keys W and P, kept in localStorage across page turns); at a fit the page scrolls, not the stage; zoomed, the stage is the only scroller; the capsule stays at the bottom of the viewport; the unzoomed stage is `overflow: clip` (the server-rendered half-size scan widened the phone page before hydration and made Chromium skip the view transition, which broke back.spec:163).
- Diagnose from 1000 (spec §9.1, §9.2): the field sits at the top of the column in flow, at most 720 wide, with no toast lift; Enter scrolls it back into view for the next code. The phone dock is unchanged.
- Small fixes: the Workshop Appearance row wraps under 413 through a container query scoped in WorkshopHub.svelte; the code badge is `flex: none`.
- Tests: unit checks (m)-(p) in tests/unit/design-system.test.ts (`--content-w` and `--hub-w` in use, no `main.wide` or `wide` prop, the only ch value is `--measure`, nowrap mono cells and `.code`, the Matrix 1000 block). tests/e2e/layout-overflow.spec.ts holds the P2-4 suites: page scroll at eight widths, tables §8.9, matrices §9.6, the map from 1000, the manual viewer, the Diagnose field, widths and measure §3.1 (60-80 characters a line). design-system.spec.ts has a desktop test for the field above the results; handbook.spec.ts covers the fit buttons. 38 of the new e2e tests failed at HEAD; 15 are guards that already passed.
- Reviews: the critic said revise with 13 problems (prose measure on the column, hub alignment, the phone grid, the tick overlap, the matrix overflow, the map gutter, the Diagnose results dock, the manual capsule, duplicate spec files); dynamic fix_needed with 2 major and 7 minor, static fix_needed with 5 major and 3 minor; the fix round fixed all but three (the `--ground` panel is the documented decision, fuses stays plain by decision, the Location pair label did not reproduce); the recheck came back fix_needed with 1 major (switch-matrix row-header pins `U18-11` wrapped after the hyphen from 1000) and 1 minor (three prose blocks outside the measure); a second fix round (two agents) fixed both. All 15 IDs marked fixed.
- Skipped e2e counts grew (phone-dark 3 to 47, desktop-light 80 to 112): every skip is a `test.skip` gated on the `isMobile` fixture (24 call sites, 14 of them in layout-overflow.spec.ts, several inside width loops); there is no fixme or describe.skip, and contrast.spec.ts gates by project with an early return that still reports passed. Rows 2 and 6 of the switch matrix row header still take two lines from 1000 and on A4, now broken at the separator. The `.gf` measure reaches every group footer (all plain text and links; 52ch only caps, never widens).

### P2 item 4 verification (default base, fresh build)

| Check | P2 item 3 | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | the same 7 | the same pre-existing errors (5 errors, 8 warnings, 7 files) |
| pnpm lint | clean when scoped past the foreign worktree | clean when scoped past the foreign worktree |
| prettier | the same two md files; CRLF files clean with the flag | the same two md files; tokens.css clean with the flag, 7 added lines only |
| vitest | 154/154 | 160/160 |
| pnpm build | 349 pages | 349 pages |
| e2e phone-dark | 413 passed, 3 skipped | 444 passed, 47 skipped (all isMobile gating) |
| e2e desktop-light | 336 passed, 80 skipped | 379 passed, 112 skipped (all isMobile gating) |

### P2 item 5 status (accessibility: AY-01, AY-02, AY-05, AY-06, AY-07, AY-09, AY-10, AY-11, AY-12, AY-14, AY-15, and the `.field` border carried over from item 3)

- Map keyboard model (spec §7.5-§7.7): the drawing is the one tab stop; every marker is `tabindex="-1"` except under `?calib=1`, where calibration's nudge owns the arrows. Arrow keys move a cursor over the rendered marker positions (left/right in reading order, up/down to the nearest marker in the column), Shift+arrows pan, Enter or Space selects; a keyboard selection (`e.detail === 0`) moves focus to the phone sheet or the wide panel, which now carries the "Selected part, {Kind} {id}" label; a pointer selection leaves focus alone; Deselect returns focus to the marker without scrolling; the embed on /handbook/rules keeps focus on the marker. A focused jet marker lifts above the lamp over it.
- Focus visibility (AY-02): `scroll-padding-bottom` on html adds the tab bar and `--toast-lift`; the matrix cells keep their own scroll margin without doubling it. The skip link (AY-05) is a 44-tall pill on the bar when focused, ring drawn inside in `--on-amber` (on the phone it covers the back link and title while focused; kept, since the pill is gone once focus moves on).
- Links (AY-06): inline links in running text get an underline in both themes; rows, chips, segmented links, the badge link and the hub lists do not; print keeps `text-decoration: none` through the same rule.
- Matrix (AY-07): each cell link's name carries the status ("13 Start Button, Fault") and a corner mark shows it without colour; the keyboard contract, the A4 print fit and the contrast sweep are unchanged.
- Live regions (AY-09): a shared debounced helper (src/lib/live.svelte.ts, 400 ms, silent on load and for a pre-filled `?q=`, with `rebase()` and `arm()` for filter changes) feeds an sr-only polite region on every search surface (Diagnose results through an `oncount` callback from DiagnoseSearch, HandbookToc, ManualSearch, PartsList, PlayfieldMap's list, tables.astro). `role=status` stays only where spec §12 lists it; the strict status tests on /care, /setup and /shopping are green. /parts keeps its old `role=status` and reads "No parts match “q”." when empty.
- Setup names (AY-10): every input and suggestion button has a unique name that includes the step name; the visible "Set to" label is unchanged; setup.spec.ts uses the new names.
- Page viewer (AY-11): src/lib/keys.ts `isTypingTarget` guards every single-key shortcut (also the matrix handler in switches.astro) and Ctrl, Cmd and Alt are ignored; the zoomed stage is focusable, scrolls with the arrow keys in JS (40 px a press, stops at its edges) and its name and the 0 key are listed in the toolbar titles and the legend; prev/next at the ends are `aria-disabled` without a tab stop.
- Targets (AY-12): 44 px hit areas by `::after` or min-height on StatusRow's seg and note field, chips (DiagnoseSearch, which also scroll a focused chip into view), the handbook contents summary, ShoppingList links, DeviceData's file label, SetupGuide's set row and handbook link, menu cards, appendix and /verify links, manual index headings, map list rows and `.src`, ComponentCard title and dd links, the table key-column links (a 44 box anchored at the left edge), and `.tlink`; the sidebar sub-rows are 44 (shell.spec.ts updated, spec §6.4). The 44 sweep in a11y.spec.ts covers 26 pages, exempts only links inside running text (3+ words of their own, not in a nav, heading or `.links` list) and accepts a 44 box flush with an edge. Handbook table page refs were allow-listed by the first fix round with an inaccurate size claim; fix round 2 gives each page ref (an `a[href*='#pg-']` or `a[href*='/manual/']` in a `.prose` cell) an inline-block 24 x 26 box with the cell on nowrap and a print reset to inline, so the 106 refs on /handbook/quick sit at least 24 px apart in the unchanged 33 rows; the allow-list passes such a ref only at 23.5 wide or more with every other target in its table centred 24 or more away. The appendix's three running-text cell links are untouched.
- Headings and fields (AY-14, AY-15, `.field` 3:1): handbook sections step h1 > h2 > h3 (render.ts; the shot-map embed's own h2 is untouched) and the owner's note is a named note beside the prose; `.field` and `.search` show the 2 px ring on focus and their edge uses the new `--field-line` token (#726b7a dark, #7f7769 light, #767676 print) at 3:1 or better over every surface fields sit on; unit check (u) and the contrast sweep cover the edges; the pinned dark tokens test (k) is extended for the new token.
- Tests: tests/e2e/a11y.spec.ts (new, 96 tests across the two projects; 77 failed at HEAD, 19 are guards), unit checks (s)-(v) (key handlers import isTypingTarget and PageViewer returns on modifiers first, markers are buttons with `tabindex={calib ? 0 : -1}`, the field edge token and ring, the live helper usage), contrast.spec.ts extended for the field edges, setup.spec.ts and shell.spec.ts updated. design-system.spec.ts:53 (the bare `.btn` height in the Go sheet) was flaky at HEAD on a sub-pixel transform value and now waits for the sheet's animations and compares the rounded height.
- Reviews: the critic said revise with 16 problems (calibration arrows, keyboard-selection detection, focus on deselect, the embed, jets under lamps, multi-position parts, the tab-count test, doubled scroll margins, the skip link, the underline selector hitting segmented links, the matrix mark, live regions in search mode only, non-unique setup names and Label in Name, the viewer guards, `::after` on contiguous rows, the `.prose h2` rule, the field ring and print value); dynamic fix_needed with 1 major (the 44 sweep measured 13 pages and let many targets through) and 6 minor, static pass with 4 minor; the fix round fixed all but the phone skip pill covering the bar while focused (kept, with the reason); the recheck came back fix_needed with 1 major (handbook table page refs 9-33 x 19 with centres 21 px apart) and 2 minor (ManualSearch's Document filter silent after a `?q=` prefill, fixed with `onchange={live.arm}`; the flaky height assertion); a second fix round (two agents) fixed all three. All 12 IDs marked fixed.
- Known: the zoomed stage's JS arrow scrolling drops the browser's smooth scroll and key-repeat acceleration. ManualSearch's visible count line reads "1 page" now (it said "1 pages" before this item). Skipped e2e counts are unchanged (47 phone-dark, 112 desktop-light, all isMobile gating).

### P2 item 5 verification (default base, fresh build)

| Check | P2 item 4 | Now |
|---|---|---|
| pnpm check | 0 errors, 16 hints | 0 errors, 16 hints |
| svelte-check (dlx) | the same pre-existing errors | the same 5 pre-existing errors |
| pnpm lint | clean when scoped past the foreign worktree | clean when scoped past the foreign worktree |
| prettier | the same two md files; tokens.css clean with the flag | the same two md files; tokens.css clean with the flag, 6 added lines only |
| vitest | 160/160 | 164/164 |
| pnpm build | 349 pages | 349 pages |
| e2e phone-dark | 444 passed, 47 skipped | 508 passed, 47 skipped (back.spec:464 and :672 flaked once each in one run, green alone) |
| e2e desktop-light | 379 passed, 112 skipped | 443 passed, 112 skipped |

### P3 item 1 status (one name per thing: CP-01..CP-20, UX-06, UX-07, UX-10, CR-09)

- **Glossary** (spec §13.1, one term per thing). A component is OK, Fault or Not tested, and the shopping list clears a fault with Fixed; "Broken" is gone. Codes are `32`, `L55` and `SOL 01` everywhere, via `componentCode()`. A switch, lamp or solenoid is a component; a catalogue entry with a part number is a part. The tab is Handbook, the transcribed text is "the handbook", the scanned documents are "the manuals" (by `DOC_NAME`), the app is "the app" or "The Addams Family Handbook" (TAF Handbook stays the home-screen label); "scan", "OCR" and "PDF" left the copy ("manual page", "page image", "machine-read"). One verb per destination: "Show on map", "Details", "Manual p. {label}", "View the manual page". UK spelling in copy (colour, grey, centre); src/content and quoted manual phrases keep the manual's words. Progress reads "{done} of {total}". Dates read "21 Sep 2026" in local time (`shortDate`); the export file name stays ISO, now from the local date. Search fields read "Search {things}" and empty states 'No {things} match "{q}".', with the P2-5 live regions untouched. Counts go through `plural()` or `agree()`. App-authored headings say "and", not "&". Wire colours are spelled out (Grey). Page references read "{DOC_NAME} p. {label}", or "{DOC_NAME} PDF page {n}" when the manual prints no label; "p." never prints a PDF index. One `locationLine()` per kind. Backup is the noun, back up the verb. The Care hub row reads "Every week to every year". Developer paths left the owner copy. Every route has its own meta description (349 pages).
- **Helpers.** `src/lib/copy.ts` (KIND_LABEL, agree, plural, componentCode, locationLine, kindLine, capitalise), `pages.ts` pageTitleText and pageRefText, `status-io.ts` shortDate, whenLabel and localIsoDate, `wire.ts` wireName. Stored values, the export JSON (version 2), the storage keys, routes, ids and content file names are unchanged. 83 files changed.
- **Link spacing.** The six pages with "andp. ii" style joins have a space or punctuation before every inline link (copy lint rule (d); Svelte 5 keeps the line break, so the rule's line-break form applies to .astro only).
- **Spec and log.** New §13 Copy: the glossary (§13.1) and six rules (§13.2: state words, codes, p. and PDF page, inline-link spacing, page names, Source links); §6 to §12 carry the new labels. app-redesign.md has the P3-1 entry dated 2026-10-01 with the kept-by-decision list, the deviations, "Review fixes" and "Recheck fixes".
- **README and CHANGELOG.** README rewritten for today's app (64 handbook pages, the routes, the tab labels, Fliptronics J805/J806, "page images"), with copy.test reading it. CHANGELOG Unreleased gains the redesign, audit P0 to P2 and this copy pass.
- **Tests.** `tests/unit/copy.test.ts` lints the sources against rules (a) UK spelling, (b) "n of m", (c) state words, (d) inline-link spacing, (e) plural(), (f) "and" in titles, (g) no scan/OCR, (h) "PDF page n", (i) no developer paths, (j) component not part, (k) the appendix wording, (l) Source links name their page, plus README checks; `copy-helpers.test.ts` and status-io date tests are new; e2e additions in tables, shopping, diagnose, storage, shell, a11y, layout-overflow, handbook, map and more. Every new test was proved failing on HEAD; existing assertions were updated to the new words, none weakened.
- **Reviews.** Dynamic review fix_needed (one major: every flipper switch said J806 while the buttons sit on J805; five minor), static review pass with seven minor. The fix round fixed all but one: the `/coils` flasher rows are one line taller on a phone (106 to 128 px) because the full wire names push the pin pair to its own line, which is §8.9's wrapping rule (kept). The recheck passed with five minor issues, fixed after the workflow by the orchestrator: the `/switches` segments now read Matrix / Dedicated / Flippers with the connectors in the panel headings (which also removes the "Dedicated J205" overflow at 360 px), the lamp service note writes the bulb only when the lamp has one (lamps 41, 76, 88), the CHANGELOG counts six rules, the spec's Recent examples carry the year.
- **Known, not changed.** HISTORY_MAX 10 and undo for Fixed are behaviour, out of this item. The Operator's Handbook page title "Solenoid table" and the appendix content ("Setup step 3", "scan", "Gray/Yellow") keep their words. DiagnoseSearch keeps hidden haystack keywords and Diagnose's examples keep "SOL 7" to show what the parser accepts. svelte-check is down to 3 pre-existing errors (a bad DocId import in DiagnoseSearch was fixed on the way). src/pages/404.astro and map.astro need `--end-of-line crlf` for prettier (pre-existing). back.spec view-transition tests (:163, :616, :681) can flake on timing like :464 and :672.

### P3 item 1 verification (default base, fresh build)

| Check | P2 item 5 | Now |
|---|---|---|
| `pnpm check` | 0 errors, 16 hints | 0 errors, 16 hints |
| `pnpm dlx svelte-check` | the same 5 pre-existing errors | 3 pre-existing errors (BottomSheet, PlayfieldMap, WorkshopHub) |
| `pnpm exec eslint . --ignore-pattern '.claude/**'` | clean when scoped past the foreign worktree | clean |
| `prettier --check` | the same two md files, tokens.css clean with the flag | the same two md files, plus 404.astro and map.astro (pre-existing, CRLF) |
| `pnpm test` (vitest) | 164/164 | 238/238 |
| `pnpm build` | 349 pages | 349 pages |
| e2e phone-dark | 508 passed, 47 skipped | 526 passed, 47 skipped |
| e2e desktop-light | 443 passed, 112 skipped | 460 passed, 113 skipped |

All skips are isMobile project gating (25 test.skip sites; no fixme, no .only). The e2e counts are from a full run on the final tree after the recheck fixes.

### P4 item 1 status (presentation helpers: AR-05, SV-07, AR-16, AR-09, AR-12, AR-14, SV-12, CP-14)

- **Invariant.** A pure refactor, proved rather than argued: every html, json, css, txt, xml and webmanifest file under dist is byte-identical to the 1a14a76 build once `.HASH` names are normalised (360 files compared by content, the 240 binaries present on both sides and the sw.js precache URL set equal; scratchpad `p4-1-distdiff.mjs`), and 44 of 44 client snapshots (22 at phone 412x915 with touch, 22 at desktop 1440x900: the map selection for 32, D1, 14, L13, L76, SOL 05 and SOL 16, the sw, lamp, coil and shot layer lists, calibration, Diagnose codes and shared faults, search for flipper and illumination, the handbook TOC filter and Continue link, the switches and lamps panels, shopping) are byte-equal between a HEAD preview and the new one (`p4-1-snap.mjs`). Svelte SSR hydration markers encode the block tree, so every touched template keeps its `{#if}` and `{:else if}` shape (`{#if sw}` became `{#if w.kind === 'switch'}`, nothing was collapsed).
- **Helpers, one home per thing.** `src/lib/copy.ts` holds the vocabulary (KIND_LABEL, KIND_PLURAL, TABLE_LABEL, MAP_LAYER, LAYER_KIND, LAYER_LABEL, MAP_TITLE) plus componentName, tileCode and inMatrix; `url.ts` builds every map, handbook and table link (mapHref, handbookHref with `anchor === undefined` as the no-anchor test, tablePath, tableHref); `pages.ts` prints every page label (pageImage with a suffix argument, printedPageText, pageCellText); the new `present.ts` returns the wiring and callouts per kind as a discriminated union that narrows without `!`, every piece `?? ''`; the new `handbook/links.ts` (tocIndex in insertion order, headingHref) replaces the three heading-index copies in care.astro, setup.astro and ComponentPage.astro, with `toc.ts` handbookIndex(); `appendix.ts` gains appendixHref and `components.ts` gains mapOf, while LAYER_SOURCE and the KIND_LABEL re-export are gone. The Layer and MapKind types live in model/types.ts. 38 source and test files changed, four added.
- **Stays hand-typed** (design §4): page ranges and the en.ts hint prose, the Matrix header rows and appendix prose, the nav.ts rows (tested equal to tablePath and TABLE_LABEL), the handbook hub link, PlayfieldMap's shot words, the table `#` cells, render.ts link strings, the data col and row filters, the pages.ts TOC titles and src/content prose.
- **Structure lint.** `tests/unit/structure.test.ts` strips comments, walks src/**/*.{ts,svelte,astro} without src/content, and bans each old pattern outside its home: map links outside url.ts, handbook links outside url.ts and render.ts, heading indexes outside handbook/, hand-typed page labels outside pages.ts and en.ts, the vocabulary words outside copy.ts, nav.ts and pages.ts, kind ternaries and KIND_LABEL joins outside copy.ts, the `L` prefix, the fuse dash and callout joins outside present.ts, the nav rows, and the vocabulary exports, imports and keys. All 14 checks fail on HEAD and a control test proves each rule still matches inside its home (the ternary rule aside, which has none) (7, 26, 9, 11 and 5, 27 lines, 5, 5, 2, 5, the nav rows, 3, 5 and 7 hits) and pass now; the helper tests fail on HEAD because the helpers do not exist there.
- **Chunk graph, the only intended difference.** ComponentCard and ComponentDetail no longer load components.json (their closures shrink by 57 KB each) because they use mapOf; Rollup merged present.ts into the StatusRow chunk (+796 B, closure +2.5 KB as it now pulls copy) instead of the separate 0.6 KB chunk the design expected; copy +516 B, url +277 B, pages +131 B; the other closures grow by 0.25 to 1.3 KB from the shared chunks. Both gates hold: no chunk grew by more than 1 KB and no island closure gained the components or pages data. switches.astro imports the lib modules above Matrix because Astro orders head CSS by import position and the tie would otherwise move Matrix.css above the `.tabs` style (the dist diff catches any future reorder).
- **Spec and log.** app-redesign-spec.md §13 names the helper homes in four lines; app-redesign.md has a "Presentation helpers" Decisions bullet after the P3 entry covering the homes, the template rule, the casts that stay, what stays hand-typed, the lint, the tests and the proof numbers.
- **Reviews.** One adversarial review (Opus, read-only) on top of the implementer self-check passed with seven minor findings, all fixed before the commit: the dist-diff wording now counts what is compared (360 text files by content, 240 binaries by presence, and the sw.js precache URL set, which the script now compares: 448 URLs equal), the log entry no longer calls spec §13 unchanged and names the Continue reading link, spec §13 lists appendixHref, the structure lint gained a control test that proves each rule still matches inside its home, switches.astro explains its import order, and the phone snapshots of D1, 14, L13, L76 and SOL 16 now probe a wiring string, so they prove partBody rendered (rerun: 44/44 byte-equal). Confirmed good: every new value in the Svelte islands is $derived or {@const}, so no label goes stale after a prop change; handbookHref treats only undefined as no anchor; present.ts uses the nullish fallback everywhere (the designed fuse dash aside); no test was weakened; no new non-null assertion beyond the designed links.ts lookup; nothing in design §4 was converted; the StatusRow chunk holds present.ts by Rollup grouping (StatusRow imports only status.svelte and types) and every importer already loads copy, so no island downloads extra bytes.
- **Known, not changed.** present.ts shares the StatusRow chunk by Rollup's grouping, not by an import from StatusRow; splitting it out would need a manualChunks rule, which is P4 item 5's territory (payload). ComponentCard is never server-rendered, so its only proof is the client snapshot. The two unused lamp casts eslint flagged were removed; the other casts stay as the design says. Running pnpm inside the scratchpad HEAD copy rewrites the shared node_modules workspace state (its node_modules is a junction), so HEAD-side runs use the node binaries directly.

### P4 item 1 verification (default base, fresh build)

| Check | P3 item 1 | Now |
|---|---|---|
| `pnpm check` | 0 errors, 16 hints | 0 errors, 16 hints |
| `pnpm dlx svelte-check` | 3 pre-existing errors (BottomSheet, PlayfieldMap, WorkshopHub) | the same 3 pre-existing errors |
| `pnpm exec eslint . --ignore-pattern '.claude/**'` | clean | clean |
| `prettier --check` | the same two md files, plus 404.astro and map.astro (pre-existing, CRLF) | the same (no new differences) |
| `pnpm test` (vitest) | 238/238 | 272/272 |
| `pnpm build` | 349 pages | 349 pages |
| dist diff against the 1a14a76 build | (new) | IDENTICAL: 360 text files, 240 binaries present, sw.js precache equal; both chunk gates pass |
| client snapshots against a HEAD preview | (new) | 44/44 byte-equal |
| e2e phone-dark | 526 passed, 47 skipped | 526 passed, 47 skipped |
| e2e desktop-light | 460 passed, 113 skipped | 460 passed, 113 skipped |

All skips are isMobile project gating (no fixme, no .only). The e2e counts are from the full run before the review fixes, which touched a frontmatter comment (the dist diff was rerun and is identical), a unit test, the two design documents and the two scratchpad proof scripts.

### P4 item 2 status (split PlayfieldMap: AR-06, SV-08, SV-03)

- **Invariant.** A refactor proved three ways against the frozen 579d801 build (scratchpad `head2`): the dist is byte-identical for all 598 non-chunk files once `.HASH` names, `svelte-xxxx` class tokens, `<!---->` glue and the PlayfieldMap island `uid` (Astro's shorthash of the island's SSR html plus props, so it follows the svelte tokens) are normalised (`p4-2-distdiff.mjs`); 52 of 52 client captures (26 map states at phone 412x915 with touch and at desktop 1440x900: layers, selections, the sheet, the panel, the handbook embed, calibration, deep links with `z`) are equal in normalised DOM and in a computed-style census of every element (`p4-2-snap.mjs`, `p4-2-states.mjs`); and 52 of 52 screenshots of the same states are pixel-identical with the navigation shell masked (`p4-2-shots.mjs`). Both sides are served by the same static server (`p4-2-serve.mjs`) because two `astro preview` processes cannot share one install and `astro preview` renders the desktop embed's bottom band intermittently.
- **The split.** PlayfieldMap.svelte goes from 2158 to 1471 lines and is now the coordinator: URL state, layers, selection, the sheet and panel, the embed list (kept inline so the server-rendered handbook pages gain no `{#if}` anchors) and the calibration CSS as `:global` rules under `.map-ui`. `src/lib/map/items.ts` holds the item model and pure helpers (`matchesQuery`, `statusOf`, the OverlayImage and CalibrationApi types); `src/lib/map/zoom.svelte.ts` is a runes module, `createMapZoom(ctx)`, that owns zoom, ready, canvas size, the first-fit effect, zoomTo and animate, pointers, pinch and double tap, with the coordinator's fit, shift, reduced motion and refs passed as closures; `MapCard.svelte` exports the card snippets (partHead, partBody, shotCard, emptyCard, deselectBtn, srcLink, prov) from `<script module>` with the card CSS, duplicating `.ph` and `.ibtn*` after `.desel` because the colour depends on source order at equal specificity; `MapParts.svelte` is the parts list and filter for the sheet and the wide panel (`inSheet`, `bind:q`, `onpick`), root `div.parts`; `MapCalibration.svelte` (runes, no style block, value imports only from its own boundary) is loaded with `import()` only when the URL carries `?calib=1`, held in a `$state` and bound to `calibCtl`, `draft`, `overlayImg` and `el`.
- **SV-03, the `/map?z=` TypeError.** Root cause proved on the baseline: the first-fit `$effect` called `zoomTo` synchronously, `zoomTo` calls `flushSync`, and `flushSync` inside a running effect nulls Svelte 5.57.1's current batch, so the effect's epilogue threw `current_batch.schedule` after the zoom had already landed. The effect now sets `ready` and defers the deep-link zoom with `queueMicrotask` (after the synchronous flush, before paint; pointer and key events are tasks and cannot interleave; a `!ready` guard stops a second run); `z` is read at two decimals, symmetric with `syncUrl`, which never writes more. `p4-2-sv03-repro.mjs`: 22 variant and viewport runs, errors=0 on every line, identical canvas size, URL and scroll to the baseline.
- **Chunk graph, the only intended difference.** PlayfieldMap chunk −1246 B; new `MapCalibration` chunk 3940 B (carries every calibration marker, unreachable from any static closure, precached in sw.js); new Vite `preload-helper` chunk 1364 B (unavoidable with a dynamic import; Base.astro's script shrinks by 1301 B as Vite moves its own helper there); client.js +224 B for the runes component path; PlayfieldMap static closure +346 B net (gate ≤ +1024 B, the same cap as every other chunk; the critic showed the design's −512 B shrink gate could not hold once MapParts' call sites and the zoom context are counted). No other chunk changes by more than 10 B. The 0.6 KB of calibration CSS still ships inside PlayfieldMap's stylesheet because a lazily imported component loses its scoped CSS (probe); a `?inline` import is proven possible and deferred to P4 item 5.
- **Tests.** Four e2e tests in map.spec.ts (no page error on `/map?z=2` and the readout lands on 2×; `z=1.0001` is the fit; a plain map visit requests no MapCalibration chunk and the island chunk carries no calibration string; `?calib=1` loads the chunk and shows the card), one wait in a11y.spec.ts, three lints in structure.test.ts outside RULES (PlayfieldMap ≤ 1500 lines; overlays.json has one importer and MapCalibration is dynamic, runes, styleless and imports no value from the static side; zoom, items and the card have one home) and a MapParts row in the design-system allow-list. All red on the baseline (the structure test's control still pins RULES.length to 12).
- **Design review.** A fable designer measured and probed (SSR anchors, lazy CSS loss, the legacy runtime cost of a non-runes lazy component, chunk sharing across the dynamic boundary), an opus critic found 4 blocking and 9 minor defects before implementation (the embed list's root `{#if}` would have changed the SSR of 11 handbook pages; the deselect button would have lost the coordinator's scoped `.ibtn` rules; lint (k) banned the `import type` lines the design itself prescribed and its dynamic-import half was satisfied by a `typeof import()` type; the closure gate was wrong by the split's own overhead), all applied. An opus reviewer then read every move against the baseline (142 CSS rules with identical declarations, every removed line mapped to a logged substitution), judged the proof-script normalisation changes sound from Astro's source (the island uid is a shorthash of the component url, the SSR html and the props, all already compared; the dropped empty `class=""` can only matter to `a:not([class])`, checked equal on every map link; no map component uses `white-space: pre`), drove twelve behaviour scenarios on both builds (keys, pinch, double tap, wheel, resize, sheet, panel, embed, hover, active and focus states, the 150 ms URL sync, reduced motion, leaving the page during the first fit: identical apart from the baseline's SV-03 errors), showed the four new e2e tests red on HEAD and green now, and passed the change with no repo edit.
- **Known, not changed.** On desktop, `?calib=1` now fits the canvas twice: the first fit runs before the lazily loaded card mounts and shrinks the stage about 14 ms later, so the canvas re-fits (animated unless motion is reduced; same final geometry; a `&z=` deep link lands against the first fit). Developer tooling only, accepted; the fix would hold the first fit while `calib && !calibEl` and measure the stage straight after `measureTop()`. On phones the calibration card's buttons are covered by the fixed canvas (the canvas carries `class:calib`, so Copy JSON and Discard cannot be tapped); this predates the split and the split keeps it on purpose, the fix is to keep only the `> :global(.calib)` halves of the two selector lists and re-baseline the calibration captures. The calibration draft and overlay render one chunk load later (developer tooling only). Every page now loads one more request (the preload helper) and about 63 B more. The duplicated `.ph`, `.ibtn*` and palette rules in MapCard and the coordinator are the price of scoped CSS across the boundary; the computed-style census proves them equal. The snapshot census does not see `:hover` or `:active`; the `.ibtn:active` rule under MapCard's hash was checked by grep in the built CSS instead. The island uid normalisation means the proof no longer catches a change that only alters the uid, which cannot happen without the html or props also changing.

### P4 item 2 verification (default base, fresh build)

| Check | P4 item 1 | Now |
|---|---|---|
| `pnpm check` | 0 errors, 16 hints | 0 errors, 16 hints |
| `pnpm dlx svelte-check` | 3 pre-existing errors (BottomSheet, PlayfieldMap, WorkshopHub) | 2 pre-existing errors (BottomSheet 100:7, WorkshopHub 53:11); the PlayfieldMap 200:61 error is gone |
| `pnpm exec eslint . --ignore-pattern '.claude/**'` | clean | clean |
| `prettier --check` | the same (no new differences) | the same five CRLF files, no new differences |
| `pnpm test` (vitest) | 272/272 | 275/275 (18 files) |
| `pnpm build` | 349 pages | 349 pages |
| dist diff against the previous build | IDENTICAL, both chunk gates pass | IDENTICAL: 598 non-chunk files; 0 chunks over limit; map island closure +346 B; MapCalibration chunk 3940 B, unreachable from static code, precached |
| client snapshots against the previous build | 44/44 byte-equal (innerHTML) | 52/52 equal (DOM and computed styles) |
| screenshots against the previous build | (new) | 52/52 pixel-identical |
| `/map?z=` page errors (22 runs) | (new; 22 on the baseline would throw) | 22/22 errors=0 (the baseline throws on 12 of 22) |
| e2e phone-dark | 526 passed, 47 skipped | 530 passed, 47 skipped |
| e2e desktop-light | 460 passed, 113 skipped | 464 passed, 113 skipped |

All skips are isMobile project gating (no fixme, no .only). The snapshot census compares the `margin` shorthand, which Blink reports unreliably for auto margins (the reviewer saw a one-off flip on both builds); the pixel shots and the box geometry cover that case. All numbers are from the orchestrator's own run after the review (the reviewer made no edit).

### P4 item 3 status (kit data boundary: AR-01, DA-02, AR-03, DA-05, DA-03, DA-04, DA-12, DA-07, DA-09, DA-16)

- **Invariant.** This item changes output on purpose, so the proof enumerates the change instead of forbidding it. Against the frozen d3dcf87 build (scratchpad `head3`), `p4-3-distdiff.mjs` lists every differing non-chunk file and holds the set to nine expectations, each tied to a finding: `switch/*` (80), `lamp/*` (64) and `coil/*` (28) island props and SSR html (translated props, the Swedish twins gone, the owner overlays applied; the expected props are computed from d3dcf87's own dictionaries plus a literal for every value the item adds, then `deepStrictEqual` per island, so the candidate's `en.ts` and `ownerNotes.ts` are held to the literals, not trusted); `switches.html` and `lamps.html` header tuples; `coils.html` coil 22's note and the three overlaid Fuse cells; `fuses.html` three row ids; `handbook/menus.html` 11 titles and 8 P.n links; `handbook/appendix.html` pg-101 and `data/handbook.json` plain["101"]; `verify.html` and `workshop.html` the `gi-colours` and `magnet-fuse` items; `data/{components,pages,callouts-page-relative}.json` gone and the sw precache missing exactly those. 19 literal gates, the chunk gates (no new chunk, none +1 KB, no island closure gains a data marker, the components literal enters no chunk that lacked it) and an importer gate; `p4-3-svscan.mjs` finds 0 Swedish strings in html and 0 in chunks (63 and 108 on the baseline). Measured: 181 of 598 non-chunk files differ, every one in an expected class; dist 653 to 650 files; precache 441 to 438 distinct URLs; chunks total −7353 B.
- **The boundary.** `src/lib/kit/{components,pages,ocr}.ts` are the only importers of `src/data/kit/*` (lint m, which matches any quoted string naming `data/kit/` after comment stripping). `src/lib/kit/translate.ts` is closed-world: every key of the kit is declared verbatim, dictionary, wire or drop; an unknown key, an overlay naming no component, a duplicate fuse key or any å/ä/ö left after a final recursive walk throws with its path. The translation runs once, at build time, through a Vite `enforce: 'pre'` transform of `components.json` (`src/lib/kit/plugin.ts`, wired in `astro.config.ts`; build, dev and vitest through `getViteConfig` alike), so the components chunk shrinks by 4.9 KB instead of carrying the Swedish twins and the dictionaries; `components.ts` asserts at init that the plugin ran. Render-time `t()`/`wireEn()` left ComponentCard, ComponentDetail, MapCard, coils.astro and fuses.astro, `t()` is gone from `en.ts`, switches and lamps lose `colWire`/`rowWire`, and `MatrixHeader` is `[wire, pin, ic]` with the index shift in Matrix.svelte and `shared-cause.ts`.
- **Owner data.** `src/data/ownerNotes.ts` carries `COMPONENT_NOTES` (`coil:02`, the hand-edited note, which left the kit JSON: `components.json` is byte-identical to the kit again), `COMPONENT_FUSES` (`coil:16`, `23`, `24`: "5A S.B. (under the playfield)", citing the ops002 footnote) and the empty `COMPONENT_WIRES` and `GI_CONFIRMED` for the G.I. decision; overlays are keyed `kind:id` and applied inside `translateKit`; `Coil.fuseDerived` is false only for overlaid coils, so the "derived from the fuse list" caption disappears there and the appendix service note for coil 16 names the printed fuse.
- **Conflicts.** DA-04: coils 16, 23 and 24 show the printed magnet fuse; coil 06 (Thing Magnet, no asterisk in the manual) keeps F105. DA-03: the manual disagrees with itself (the G.I. table on ops page 2 against the fuse list on p. 1-47 for strings 2, 4 and 5; nothing in the kit settles it), so the Verify item `gi-colours` lists exactly the disagreeing strings and a test computes the set from both sources and retires the item on either owner outcome (`COMPONENT_WIRES` if the fuse list is right, `GI_CONFIRMED` if the table is). DA-12: `app101.md` lines 11 and 33 follow MACHINE.md and app106 (the RAM in U8 is an NVRAM, no batteries, `no-old-cells` stays on the Verify list; A-15139 under the playfield, A-15416 in the backbox). DA-07: P.1 to P.8 fall back to the `P.` heading (`/handbook/menus#p24-1`) and no `data-find` is left in any rendered page. DA-09: `Fuse.key` is the id, or the slug of the circuit for the three "—" rows (`domestic-game`, `foreign-game`, `magnets`), used by the table ids and the Diagnose deep links. DA-05: `title="Har undermeny"` (11) becomes "Has a submenu" through `HANDBOOK_ATTR` in `render.ts`, because ops017.md is kit-owned; coil 22's note has its `COIL_NOTE` entry.
- **sync-kit.** `scripts/sync-kit.mjs` is a dry run by default and `--write` applies, over an explicit copy list; the committed sha256 manifest `src/data/kit/kit-sync.json` (282 entries) records what was last synced, so a file that differs from its manifest hash is "local edit, skipped" and never overwritten, write or not; the four diverged kit-docs have no entry and report "diverged, skipped"; a file removed upstream is reported, never deleted; `--write` refuses, writing nothing, while `git status` shows anything under the synced roots, and fails closed outside a git repo. The dead copies `public/data/{components,pages,callouts-page-relative}.json` and `src/data/kit/{parts,callouts-page-relative}.json` are gone (`public/data/parts.json` and `ocr-text.json` stay, they are fetched). README documents the contract.
- **Tests.** 14 new its, each red on d3dcf87 for its own reason (checked by copying the files into `head3`): `tests/unit/kit.test.ts` (8: the kit JSON's coil 02 note is the kit's, no Swedish or twins in DATA, coil 02's note equals the overlay, fuse keys unique and anchor-safe, the magnet coils by ops002's asterisks are exactly 16/23/24 and carry the `magnets` row's rating while coil 06 keeps F105, the G.I. disagreement set equals the Verify item, every manifest path hashes to its manifest value, the app101 wording), `tests/unit/sync-kit.test.ts` (3: a dry run writes nothing; `--write` copies only the list; `--write` refuses on a dirty root; git-init skeleton, absolute script path, `afterAll` cleanup), two in `handbook.test.ts` (no `data-find` in any rendered page; the set of `title=` values is exactly "Has a submenu"), text assertions in `shared-cause.test.ts` that catch a missed index shift, lint (m) in `structure.test.ts` (the control still pins RULES.length to 12) and the Verify count 15 in `hubs.spec.ts`.
- **Design review.** A fable designer measured the boundary (63 Swedish strings in html and 108 in chunks, the dead copies, the three conflicts with their sources, two translation variants built and diffed) and chose the build-time transform on the chunk numbers; an opus critic found 11 blocking and 18 minor defects before implementation (the magnet test included coil 06 and could never pass; the app101 wording claimed too much and missed the board location; the Verify count is hard-coded in an e2e spec; the G.I. test had no end state; the index-shift list missed three reads that tsc cannot catch; the Swedish guard was narrower than claimed and nothing checked that the transform ran; sync-kit had no baseline and would still overwrite committed edits; its test could not work as specified; the differ was circular and crashed once `t()` was gone), all applied. An opus reviewer then read every diff against the design and the critic (each removed line mapped to a substitution or a logged deviation), proved that nothing fetches, imports, precaches or tests the five deleted copies, checked every dictionary entry against its Swedish key and the closed-world coverage against the kit's own keys, probed the transform under build, dev and vitest and the init assert and the å/ä/ö walk with an injected Swedish string, ran the dry run, the differ and the Swedish scan on its own copy, drove the changed routes on both builds (component pages, coils, the fuses deep links, the menu-map links, Verify, Workshop, the Diagnose shared-cause text, search, the map card for coils 02 and 16: identical except where a finding says otherwise), and passed with one edit: the B6 guard caught only 3 of the 8 header-index flips in `shared-cause.ts`, so the reviewer added a switch-row test and a lamp-row wire assertion that catch all 8. Its four open items were fixed by the orchestrator after the review: the sync manifest hashes text with CRLF folded to LF (a `core.autocrlf` checkout would otherwise read every synced text file as a local edit, proved in a probe; binary files hash as is), the `astro dev` restart note is in the overlays header and the README, the stale fuse comment in `present.ts` is gone, and `sync-kit.test.ts` also proves that `--write` refuses outside a git repository.
- **Known, not changed.** Owner decisions recorded, not made: the G.I. colours for strings 2, 4 and 5 (Verify `gi-colours`); the magnet feed (app102 says the High Power board A-15139 under the playfield with F104/F111, app106 says the Extra Flipper Supply board A-15416 in the backbox) and the magnet voltage (KNOWLEDGE.md 12 V against app106 50 V); `kit-docs/KNOWN-ISSUES.md:15` still says every coil fuse is derived, true except 16, 23 and 24; the four diverged kit-docs keep diverging until the owner reconciles them. Editing `ownerNotes.ts` or `en.ts` needs an `astro dev` restart (the transform has no watch on them; documented in `plugin.ts`). Chunk deltas: components −4864 B, StatusRow −2480 B, ComponentCard +21, ComponentDetail +23, Diagnose +1, PlayfieldMap −54 (the design projected 107 B more saving; `fuseDerived` and `Fuse.key` are the difference).

### P4 item 3 verification (default base, fresh build)

| Check | P4 item 2 | Now |
|---|---|---|
| `pnpm check` | 0 errors, 16 hints | 0 errors, 16 hints |
| `pnpm dlx svelte-check` | 2 pre-existing errors (BottomSheet 100:7, WorkshopHub 53:11) | 2 pre-existing errors (BottomSheet 100:7, WorkshopHub 53:11) |
| `pnpm exec eslint . --ignore-pattern '.claude/**'` | clean | clean |
| `prettier --check` | the same five CRLF files, no new differences | the same five CRLF files, no new differences |
| `pnpm test` (vitest) | 275/275 (18 files) | 291/291 (20 files) |
| `pnpm build` | 349 pages | 349 pages; dist 650 files (653 before); sw precache 438 distinct URLs (441 before) |
| dist diff against the previous build | IDENTICAL: 598 non-chunk files; chunk gates pass | INVARIANT HOLDS: 181 of 598 non-chunk files differ, every one in an expected class, 19 literal gates; 51 chunks total −7353 B, 0 grew past 1 KB, 0 new, 0 closures gained a data marker; the only kit importers are the three boundary files |
| Swedish strings in dist (`p4-3-svscan.mjs`) | (new; 63 in html, 108 in chunks on the baseline) | 0 in html, 0 in chunks |
| `node scripts/sync-kit.mjs` dry run | (new) | exit 0, nothing written, worktree unchanged; 282 unchanged, the 4 diverged kit-docs skipped |
| client snapshots against the previous build | 52/52 equal (DOM and computed styles) | 51/52 in the full run; the one difference is the known Blink margin flip, equal on three re-runs of that state |
| screenshots against the previous build | 52/52 pixel-identical | 52/52 pixel-identical |
| `/map?z=` page errors (22 runs) | 22/22 errors=0 | 22/22 errors=0 (both builds) |
| e2e phone-dark | 530 passed, 47 skipped | 530 passed, 47 skipped |
| e2e desktop-light | 464 passed, 113 skipped | 464 passed, 113 skipped |

All skips are isMobile project gating (no fixme, no .only). The map proofs from P4 item 2 (`p4-2-snap.mjs`, `p4-2-shots.mjs`, `p4-2-sv03-repro.mjs` against the d3dcf87 dist) ran unchanged as a regression check: the one differing capture in the full run (desktop, calibration with a selection) was the known Blink `margin` shorthand flip for auto margins (A `12px 227.5px`, B `12px 0px`, same DOM, pixel-identical shot), and three re-runs of that state alone were equal; the 26 captured map states render identically on both builds, so none of them shows a field the item changed. All numbers are from the orchestrator's own runs: the full gauntlet ran alongside the review (vitest then 289), and check, lint, prettier, vitest (291), build, the differ, the Swedish scan and the dry run were run again after the reviewer's test and the orchestrator's four fixes with the same numbers; e2e was not repeated because no runtime code changed and the dist diff is identical (same 181 files, same chunk bytes).

### P4 item 4 status (CI and tooling: TT-01, TT-02, TT-04, TT-05, TT-07, TT-08, SV-19, TT-10, TT-11, TT-13)

- **Invariant.** This item changes tooling and tests, not the app, so the proof is a dist diff against the frozen 9b853f7 build (scratchpad `head4`): `p4-4-distdiff.mjs` classifies every file as identical, hash-only (the same bytes under a re-lettered chunk hash), expected-chunk (only `BottomSheet` and `WorkshopHub`, |Δ| ≤ 64 B, held to the exact pinned token diff of the two svelte-check fixes) or sw-mangle (the same precache set, identifier letters only, with a name bijection), and exits non-zero on anything else, on a file only on one side and on any eol-only file. Self-checks: `head4` against itself holds; an injected html change, a listener swap in a chunk, a variable swap and a cacheName rename each fail the gate. BottomSheet's identifiers re-letter across scopes once the unused binding is gone, so the global name bijection is enforced only for WorkshopHub and sw.js; BottomSheet is held by the pinned token diff alone. Measured numbers are in the verification table below.
- **Deploy gating (TT-01).** `.github/workflows/deploy.yml` has a `pull_request` trigger beside `push` to main and four jobs: `static` (check, svelte-check, lint, format:check, build, vitest), `e2e` as a three-project matrix (phone-dark, desktop-light, phone-webkit; `playwright install --with-deps` per browser, the report uploaded on failure), `build` (the Pages build with `BASE_PATH`, then the link check run on it) and `deploy`, which `needs` all three and is skipped on pull requests; the top-level concurrency cancels in-progress runs only for pull requests, and the Pages permissions and deploy steps are as before. `tests/unit/workflow.test.ts` (4 tests, red on 9b853f7's workflow) pins that shape through js-yaml, and `p4-4-ciyaml.mjs` checks 34 properties (triggers, `needs`, every `pnpm` script exists, matrix = config projects, no unconditional `reuseExistingServer`). The first ubuntu run has not happened (see Known).
- **WebKit matrix (TT-05).** `phone-webkit` is iPhone 13 at 390×844, dark, in `playwright.config.ts`; 29 tests were red on it before the edits, none after, with no src change. Gates, each named with its cause: WebKit's Tab skips links (a11y ×3, header ×1, the two shell focus assertions), offline navigation is an internal error in Playwright's WebKit (motion, pwa), `mouse.wheel` is unsupported (layout-overflow), and `KNOWN_SCROLLS` holds the one measured overflow (`webkit 320 /coils`: 1 px, exact key and exact count, so it fails once fixed). The seven sheet openers go through `helpers.activate()` (click on Chromium, Enter on WebKit); the 412 setup test runs at 412.
- **Motion test (TT-04).** The red test was a race: a click before `motion.ts` had run turned a pop into a fade, and under load Chrome drops view transitions outright (measured: 1 of 11 with one worker, 7 of 17 with ten). `transition()` in `motion.spec.ts` now waits for DOMContentLoaded after each step and retries only a dropped transition (one that never started) up to 20 times, each drop recorded as a report annotation, so a drop is visible and a wrong transition type still fails. Motion suite with `--repeat-each 10 --workers 10`: 16/20 before, 40/40 after. CI keeps `retries: 1`, documented, not relied on.
- **Line endings (TT-07).** `.gitattributes` (`* text=auto eol=lf`, binaries marked) and `.editorconfig`; the five CRLF/mixed files (404.astro, map.astro, tokens.css, diagnose.spec.ts, map.spec.ts) are LF in the working tree and, from this commit, in the index; `prettier --check .` is clean with no `--end-of-line` exception, and `.prettierignore` excludes `.claude` (with the CI reason). map.astro's reformat is not purely EOL: Prettier's Astro plugin expands two self-closing SVG elements (`<circle />`, `<path />`), which is harmless (map.html is hash-only in the dist diff).
- **Server reuse (TT-08).** `tests/e2e/global-setup.ts` fetches `sw.js` from the configured port and compares it with `dist/sw.js`: a server of another build is refused with the port named (proved against a 127.0.0.1:4324 server of the 9b853f7 build), a free port lets Playwright start its own preview (`pnpm preview --port 4321 --ignore-lock`), and CI never reuses (`reuseExistingServer: !CI`). A stale preview started from this checkout passes, correctly, because `astro preview` serves `dist/` from disk on every request.
- **Type checks (TT-02, SV-19, TT-10).** `pnpm svelte-check` (`astro sync && svelte-check`, svelte-check 4.7.6 as a devDependency) is a gate; its two errors are fixed (WorkshopHub: an early return in `onMount`; BottomSheet: the unused `root` binding removed), both type-only (chunk diffs −38 B and +6 B, read token by token). `z` comes from `astro/zod` in `src/content.config.ts`: `astro check` hints 16 → 0.
- **Fixed waits (TT-11).** Every `waitForTimeout` in tests/e2e (21 sites, including the real 4.5 s sleep in pwa.spec.ts) is replaced by the condition the test needs (the service worker's `activated` state, `getAnimations()` draining, two frames, a settled rect, a `history.back` counter, the fake clock with a navigation counter for the two 300 ms spring-back races); each touched spec ran `--repeat-each 5` on phone-dark (pwa 50/50, storage 120/120, map 150/150, back 125 + 5 skipped, motion 40/40, a11y 350/350). The reviewer's mutation results are in the Design review bullet.
- **Scans (TT-13).** `tests/e2e/axe.spec.ts` runs axe-core (@axe-core/playwright 4.13.0) over 26 routes on every project with a documented rule set; `KNOWN` is keyed by project and route and a stale entry fails the test; proved on injected button-name, image-alt and region violations. `tests/unit/links.test.ts` resolves every href, src, srcset, CSS `url()`, island component and renderer URL, manifest and precache entry of the built dist to a file (an injected broken link and a missing dist both fail), and CI runs it on the Pages build as well.
- **Design review.** A fable designer measured the baseline (the WebKit suite 534/68/1 before any edit, the motion test 20/20 alone and 18/20 under ten parallel copies, the 16 hints, the five CRLF files, axe over all 349 pages at 9 min against 26 routes at 40 s) and chose the parallel pipeline with deploy needing every job; an opus critic found 4 blocking and 16 minor defects (the apply script did not parse, the preview command lacked `--ignore-lock`, two WebKit "download" gates were artefacts of the long scratch path, deploys gated on a CI run that has never happened; the motion test still 2/20 under load with only `retries` hiding it, a scrollWidth tolerance hiding a real 1 px overflow, an axe known-list that never flagged a stale entry, a dist diff that accepted an injected listener change and a cacheName rename, a false concurrency comment), all applied except as logged in the implementation log (12 deviations, each with its reason). An opus reviewer then read every hunk against the design and the critic in its own copy, mutation-tested the new conditions (a 100 ms timer-deferred pan, a rAF mutant, `always() &&` and `continue-on-error` in the workflow, a listener swap, a variable swap and a cacheName rename in the dist, injected axe violations and broken links, a stale `KNOWN_SCROLLS` entry, a server of another build and a hanging server on the e2e port), re-measured the proof (308/339/2/1, 0 unexpected, −38 B and +6 B), vitest 298, prettier, the workflow check, motion 80/80 with all 48 retries being dropped pushes and none a wrong type, 0 CR bytes in 273 text files with the 244 binaries marked, and passed with two edits: the Deselect test in `a11y.spec.ts` uses the fake clock (`runFor(200)`) as designed, because `twoFrames` let a timer-deferred pan through, and `workflow.test.ts` checks `deploy.if` exactly and bans `continue-on-error`, because `always() && …` passed the old `toContain`. Its five open items were fixed by the orchestrator after the review: a hanging server on the e2e port now fails with the port named (`global-setup.ts`), a missing build is caught in `playwright.config.ts` before the webServer starts (Playwright starts the server before global-setup, and `astro preview` without a build dies with an assertion), the `--ignore-lock` comment names its second job (it keeps the preview in the foreground when Astro detects an agent, auto-backgrounding being off only on Windows), the persist test's comment in `storage.spec.ts` says what the 450 ms on the fake clock proves (a mark is written at once, nothing asks again later), and the deploy job is guarded with `github.ref == 'refs/heads/main'` so a manual run on another branch cannot deploy (pinned in `workflow.test.ts`). Noted, not changed: the dist diff cannot catch an identifier-only swap inside BottomSheet (the source diff is exactly the two deleted lines; no e2e test presses Tab inside a sheet, an item for a later audit), and each CI run builds five times.
- **Known, not changed.** The first ubuntu CI run has not happened: every count here is from Windows, and the WebKit and axe numbers are pixel-sensitive, so open a pull request before merging to main, or a red first run stops every deploy. Findings the matrix surfaced, recorded for the owner: axe `target-size` on `/?q=12%2013` (`.map-link`), axe `scrollable-region-focusable` on `/handbook/quick` (`#pg-2 > .scroll-x` ×2), WebKit's Tab skipping links (focus stays on body), the /setup progress row wrapping at 390 px in both engines, and the /coils 1 px overflow at 320 px in WebKit. BottomSheet has no identifier-level dist gate (the pinned token diff only). No `.git-blame-ignore-revs` (the commit is not purely EOL because of map.astro). The stale `astro preview` on 4323 (pid 13720) is left alone.

### P4 item 4 verification (default base, fresh build)

| Check | P4 item 3 | Now |
|---|---|---|
| `pnpm check` | 0 errors, 16 hints | 0 errors, 0 hints |
| svelte-check | 2 pre-existing errors (via `pnpm dlx`) | 0 errors, 5 warnings (`pnpm svelte-check`, now a devDependency and a gate) |
| `pnpm lint` | clean | clean |
| `prettier --check .` | the five CRLF files | clean, every file, no `--end-of-line` exception |
| line endings (`git ls-files --eol`) | 5 files i/crlf or i/mixed | 0 files in the working tree (the five are stored as LF from this commit) |
| `pnpm test` (vitest) | 291/291 (20 files) | 298/298 (22 files) |
| `pnpm build` | 349 pages; dist 650 files; sw precache 447 entries | 349 pages; dist 650 files; sw precache 447 entries |
| dist diff against the previous build | INVARIANT HOLDS (181 of 598 enumerated) | INVARIANT HOLDS: 650 files each side; 308 identical, 339 hash-only, 2 expected chunks (BottomSheet −38 B, WorkshopHub +6 B), sw.js the same precache set with 3 of 17 names re-lettered, 0 eol-only, 0 unexpected |
| workflow shape (`p4-4-ciyaml.mjs`) | (new) | WORKFLOW OK, 34 checks |
| link check (`p4-4-links.mjs` over dist) | (new) | 0 broken of 17597 refs in 349 pages; 0 broken of 451 manifest and precache refs |
| e2e phone-dark | 530 passed, 47 skipped | 556 passed, 47 skipped (26 axe tests new) |
| e2e desktop-light | 464 passed, 113 skipped | 490 passed, 113 skipped (26 axe tests new) |
| e2e phone-webkit | (new) | 543 passed, 60 skipped, 0 failed |

All skips are isMobile project gating plus the named WebKit gates (no fixme, no .only). All numbers are from the orchestrator's own run of the full gauntlet after the reviewer's two edits and the orchestrator's five fixes. A first full run, taken while the reviewer's mutation runs (ten Playwright workers) shared the machine, had phone-webkit at 538 passed and 5 failed (four 60 s timeouts and one scroll position of 239 for 240 in motion.spec.ts:122); the re-run with nothing else on the machine was 543 passed and 0 failed, the implementer's count. The workflow check `p4-4-ciyaml.mjs` must be called with absolute paths (its `createRequire` needs them). Not run here: any GitHub Actions job; the first ubuntu run of the gated workflow is the user's pull request.

### Working notes for the next session

- svelte-check is not a dependency. Run `pnpm dlx svelte-check` after `pnpm check`. Run cold, it adds 3 spurious toc.ts errors.
- tests/e2e/diagnose.spec.ts is CRLF in the index. Check it with `prettier --check --end-of-line crlf`, and never run a bare `prettier --write` on it.
- Playwright reuses any server on port 4321, so check `netstat -ano` before e2e. A stale preview from 2026-09-23 still listens on port 4323.
- In Git Bash, set `MSYS_NO_PATHCONV=1` for a `BASE_PATH=/valvet/` build, or the path gets mangled. Nine older pwa.spec tests use absolute paths and fail under `/valvet/`. A BASE_PATH project in CI belongs to P4 item 17.
- The audit cites `src/lib/motion.ts`, but the file is `src/motion.ts`.
- The phone-dark push-transition test in motion.spec passed in every run this session, so it is timing-dependent, not deterministic.
- The overflow sweep compares with the configured viewport, not `window.innerWidth`, because Chromium's mobile emulation grows the layout viewport to fit overflow.
- tests/e2e/map.spec.ts is CRLF as well. Check it with `prettier --check --end-of-line crlf`.
- src/styles/tokens.css is CRLF too (since before the audit). Same prettier rule.
- Another session's locked worktree under .claude/worktrees makes bare `pnpm lint` fail; scope it with `--ignore-pattern '.claude/**'` until eslint.config ignores that folder.
- Playwright's Chromium runs with `--disable-back-forward-cache`, so bfcache behaviour (persisted pagehide and pageshow) only shows in a probe against msedge or chrome with that flag removed. The e2e tests dispatch synthetic PageTransitionEvents instead.
- "Transition was aborted" and "ViewTransition opt-in disabled" pageerrors are Chromium-internal and appear when the Navigation API is hidden in a test.
