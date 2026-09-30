# Full app audit (2026-09-29)

**Status: P0 (645d614), P1 (00c83ad, back behaviour), P2 item 1 (dc21002, header), P2 item 2 (c210aa5, component migration) and P2 item 3 (light theme and print) are committed on main. P2 items 4-5, P3 and P4 are not started.** Twelve specialist reviewers, one adversarial verifier per dimension and a completeness critic reviewed the whole app against a fresh build. There were 231 findings: 154 confirmed, 69 partly confirmed, 7 deliberate (documented decisions) and 1 refuted. Each finding below carries the verifier's recalibrated severity. The raw result, with evidence, repro scripts and a fix per finding, is in the workflow journal of session c5ab0448 (run wf_05057fc7-6a2). The rows here are enough to find each spot again.

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

P0 (645d614), P1 (00c83ad), P2 item 1 (dc21002), P2 item 2 (c210aa5) and P2 item 3 are committed on main (see Progress at the end). Next is P2 item 4, tables, matrices and large screens. The light-theme and print rules from P2 item 3 are in app-redesign-spec.md §1.1 (token table with `--brass-ink`, `--faint-ink`, `--seg-edge` and the print bullet) and §12, logged in app-redesign.md (decisions entry dated 2026-09-30, which also records the `.field` border deferral to P2 item 5), and enforced by tests/e2e/contrast.spec.ts and unit tests (g)-(l) in tests/unit/design-system.test.ts. The header rules from P2 item 1 are in app-redesign-spec.md §6.5; the tokens, button, search, stacking and radius rules from P2 item 2 are in the spec (§2, §4 Stacking table, §8.6-8.8, §10) and enforced by tests/unit/design-system.test.ts; both are logged in app-redesign.md (entries dated 2026-09-30). The P1 navigation rules are recorded in app-redesign.md, Phase 12, in the bullets dated 2026-09-29; keep them in step with any later change to motion.ts, nav-state.ts, Base.astro or Diagnose.svelte. Verify with `pnpm check`, `pnpm dlx svelte-check`, `pnpm lint`, `pnpm test`, `pnpm build` and the full e2e suite on both projects.

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
