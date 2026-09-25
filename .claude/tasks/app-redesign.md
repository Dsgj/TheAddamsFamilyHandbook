# App redesign: five tabs, a fitted map, app-like shell

**Status 2026-09-25: design published (canvas, 32 boards); handoff reviewed and corrected against the repo and the boards; implementation not started. Next: Phase 1.**

- Spec (all values): `.claude/tasks/app-redesign-spec.md`.
- Design canvas: https://claude.ai/artifact/UafRUTDKLxz4RYNuLmeeuh.
- This plan supersedes an earlier workshop-mode slice (`.claude/tasks/mobile-redesign.md` plus diffs in `tokens.css` and `base.css`). That slice was never committed: it sits only in the `addams-handbook-mobile-redesign-fc850f` worktree, not on `main` (see Q1).

## How to run a phase

1. One phase per session.
2. Start by reading this file, the spec and `git status`. Read only the files the phase names; don't rescan the repo.
3. Open the boards the phase names with the Artifact tool: action "read", url https://claude.ai/artifact/UafRUTDKLxz4RYNuLmeeuh, path "project/<Board>.dc.html". The canvas is private to the owner's claude.ai account. If it can't be read, the spec file is authoritative.
4. If an open question blocks the phase (the tag after each question), ask the owner first.
5. Finish with the gauntlet green:
   - First time in a worktree: it has no `node_modules` (only the main checkout does). Run `pnpm install --frozen-lockfile` (as CI does, `.github/workflows/deploy.yml:27`), then `pnpm exec playwright install chromium` if the browsers are missing.
   - Stop any stray preview on port 4321 first: locally Playwright reuses a running server (`playwright.config.ts:30` `reuseExistingServer`), so a stale preview tests an old build. `shopping-list.md` used `pnpm exec astro preview stop`; if the Astro CLI rejects that, stop the process listening on 4321.
   - Run `pnpm check` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm test:e2e`.
   - Record `grep -ro 'data-find=' dist --include=*.html | wc -l` (the target is Q4). Don't use `grep -c`: the built HTML is compressed onto few lines and Git Bash has no globstar, so `grep -c … dist/**/*.html` under-counts.
   - Base-path check, last (it leaves `dist` built with a base): `BASE_PATH=/TheAddamsFamilyHandbook/ pnpm build`, then `grep -rhoE '(href|src)="/[^"]*"' dist --include=*.html | grep -v '="/TheAddamsFamilyHandbook/' | sort -u`. Expect no output. CI deploys under `/<repo>/` (`deploy.yml:32`). If the first run (before Phase 1) already lists some, record them here as the baseline and add none.
   - Report exit codes and counts, not logs.
6. Then update the status line, tick the phase below and note any deviations under it.
7. Commit only when the owner says so.
8. End the reply with `>> CONTEXT: checkpoint in .claude/tasks/app-redesign.md — /clear is safe`.

Baseline before Phase 1 (from `playfield-map.md`, last green run):

- vitest 49 across 9 files.
- e2e: 24 tests per project across smoke 10, features 8, setup 2, shopping 2, care 1 and appendix 1. The smoke suite counts 20 over both projects.
- Build: 0 errors.
- data-find: 8, counted with `grep -ro 'data-find=' dist --include=*.html | wc -l` on the main checkout's `dist`. The links come from `src/lib/handbook/render.ts:105` (a handbook reference with no heading to resolve to).

## Decisions

- **Tabs.** Five tabs in job order:

  | Tab | Replaces |
  |---|---|
  | Diagnose | Diagnose and the header search |
  | Map | Map |
  | Tables | Switches, Lamps, Solenoids, Fuses |
  | Handbook | Handbook, Manuals, Parts |
  | Workshop | Shopping list, Verify, Setup, Care, the theme control, device data |

- **Home.** Diagnose is home. Quick links (Playfield map, Switch matrix, Lamp matrix) sit at the top, recent reports under them, and the paste field is docked low.
- **Tab 5.** The shopping list lives in Workshop, and its count rides on the Workshop badge. The variant that makes Shopping list tab 5 is not the default. The Rationale §06 board argues both sides and recommends Workshop; it is the owner's call (Q2).
- **Breakpoints.**

  | Width | Navigation | Map selection |
  |---|---|---|
  | < 600 | tab bar | bottom sheet |
  | 600–999 | 80 px rail | bottom sheet |
  | 1000–1279 | rail | 400 px side panel |
  | ≥ 1280 | 256 px sidebar | 420 px panel |

- **Map fit.** At 1× the whole playfield is always visible: `s = min(stageW/1246, stageH/2702)`, centred horizontally and top-aligned.
  - `stageH = 100dvh − stageTop − tab bar − safe-bot`, where `stageTop` is the scroller's measured document top. In the final phone layout that is safe-top + top bar (47 + 44 = 91, spec §7.1); before Phase 5 it is whatever the interim header and, on wide screens in calibration, the docked card add up to.
  - `/map` is full-bleed: `main` drops the `.wrap` padding (16 px, base.css:81-85) and the footer isn't rendered there (Base.astro:92-99). Nothing else sits under the stage, so **the page itself never scrolls** (Rationale).
  - While a part is selected on a phone at 1×, the drawing re-fits above the 96 px peek sheet.
  - Above 1× the map only pans; Fit returns to 1×.
- **Footer.** The footer (the Williams / Midway copyright paragraph) stays on every page except full-bleed `/map`. From Phase 3 the same paragraph is also in Workshop → About this handbook. `#sw-status` leaves the footer in Phase 1 (a fixed line above the tab bar) and becomes the toast in Phase 11.

## Routes

| Route | Tab | Presentation | Nav key today |
|---|---|---|---|
| `/` | Diagnose | tab root, home; `?q=` prefills | diagnose |
| `/map` | Map | tab root, fitted; `?layer=`, `?id=`, `?calib=1` | map |
| `/switches` | Tables | pushed; segments Matrix / Dedicated J205 / Flipper J806 | switches |
| `/lamps` | Tables | pushed; the matrix and all 64 lamps | lamps |
| `/coils` | Tables | pushed; three hub rows open it (Q8) | coils |
| `/fuses` | Tables | pushed, at `#fuses`, `#leds` or `#jumpers` | fuses |
| `/switch/[id]`, `/lamp/[id]`, `/coil/[id]` | Tables | pushed onto the tab that opened it; a cold link opens in Tables | switches / lamps / coils |
| `/handbook` | Handbook | tab root, Handbook segment | handbook |
| `/handbook/[section]` | Handbook | pushed reader with its own toolbar; `#pg-N` and `#p1-15`-style anchors | handbook |
| `/manual` | Handbook | segment Manuals | manual |
| `/manual/[doc]/[page]` | Handbook | pushed viewer; Go to page is a sheet | manual |
| `/parts` | Handbook | segment Parts | parts |
| `/shopping` | Workshop | pushed; its count is the badge | shopping |
| `/verify` | Workshop | pushed | verify |
| `/setup` | Workshop | pushed, listed as "Machine setup" | setup |
| `/care` | Workshop | pushed | care |
| `/tables` (new) | Tables | tab root, hub | — |
| `/workshop` (new) | Workshop | tab root, hub | — |
| `/404` | none | keeps its TILT page (Q9) | — |
| `/data/handbook.json` | none | data endpoint, unchanged | — |

Some things open as sheets with no URL of their own: Show on map, Add to shopping list, Go to page, Install, All parts on the map and About this handbook. The map layers are floating toggles.

## Keep

- **Routes.** Every route above, with `build.format: 'file'` and `trailingSlash: 'never'` (static output) unchanged.
- **Base path.** The site deploys under `/<repo>/` (`BASE_PATH`, `.github/workflows/deploy.yml:32`; `astro.config.ts:7-9`). Every internal URL is built with `href()`, `componentHref()` or `manualHref()` from `src/lib/url.ts`, as the nav does today (Base.astro:4, :82). That covers nav.ts entries, back links, hub rows, map deep links such as `/map?layer=sw&id=32`, the icon and splash links, and anything else new. Never write a root-relative `"/…"` link. The manifest's `start_url` and `scope` stay the base-aware `scope` (astro.config.ts:9, :30-31). The gauntlet's base-path check enforces this.
- **URL parameters.**
  - `/map`:
    - `layer=` takes sw, lamp, coil or shot, a comma list, or `all`. The default is sw, lamp, coil.
    - `id=` is bare (`32`) or prefixed (`shot:K`).
    - `calib=1`.
    - The URL stays in sync through `history.replaceState` (PlayfieldMap.svelte:142).
  - `/?q=`: the Diagnose prefill.
  - Anchors: `/fuses#fuses|#leds|#jumpers`, `/handbook/[section]#pg-N` and `#pN-NN`.
- **Storage keys.**
  - `tafh:status` (legacy `valvet:status`), `tafh:theme` (legacy `valvet:theme`), `tafh:setup`, `tafh:verify`.
  - `taf.positions.draft` (calibration drafts).
- **Status and log.** Status (OK / Fault / Not tested) persists on the device, and pressing the chosen value again clears it. The service log records every change.
- **Shopping list.**
  - It is derived from Fault status (`src/lib/shopping.ts` groupFaults) and grouped by part number.
  - The kind groups keep their titles from `KIND_TITLE` (`src/lib/shopping.ts:26-30`): **Lamps**, Switches, Solenoids. The board's "Bulbs" is not adopted: the text export and three tests depend on "Lamps" (shopping.spec.ts:16, :21-23; features.spec.ts:77).
  - Each group is a `section.grp` whose title is a real heading (`<h2>`, shopping.spec.ts:16, :35-36 use `getByRole('heading')`).
  - Each item links to its component page with the text `{itemRef} {name}`, e.g. "C01 Chair Kickout" (`itemRef` = KIND_PREFIX L / S / C + id, shopping.ts:31-33; shopping.spec.ts:37-40).
  - "Fixed: {name}" (the `aria-label` on each row's Fixed button) clears the fault (shopping.spec.ts:25).
  - The empty state keeps the text "Nothing marked Fault yet" (shopping.spec.ts:26).
  - "Copy as text" and "Show text" with its textarea stay; the export text is unchanged (`Lamps\n1 × #555 (24-8768): L11 Thing Multiball`, shopping.spec.ts:21-23).
  - The "Service kit" section on `/shopping` (shopping.astro:50-96) stays on that page, below the list. The Shopping board doesn't draw it; restyle it as a group.
- **Device data.** Backup download and restore, and the two-tap "Clear all" → "Really clear all?". It lives on `/shopping` today (`.device`).
- **Tables pages.** The "Broken" fault-check ticks stay on `/switches` (both the Dedicated J205 and the Flipper J806 tables, switches.astro:25-98), `/lamps` (lamps.astro:55) and `/coils` (coils.astro:66): `input.fault-check` with `data-kind`, `data-id` and `aria-label="Broken: {name}"`, and each page keeps its `import '~/lib/fault-check'` (switches.astro:103, lamps.astro:71, coils.astro:153). shopping.spec.ts:6, :31, :33 tick them. `/lamps` keeps `table.matrix td.st-fault [data-cell]` (shopping.spec.ts:10).
- **Component pages.**
  - The `.notes` block with "Service notes" and its appendix links (ComponentPage.astro:44-65; appendix.spec.ts:7-12, :21-22).
  - The "Service log" list, found by `getByLabel('Service log')`, with one `li` per change (features.spec.ts:29-39).
  - Exactly one visible button whose name contains "Fault" and one named exactly "OK": the status control, with `aria-pressed` (smoke.spec.ts:61-66; features.spec.ts:31-32, :43-45). No other visible button on the page may contain "Fault" (for example "Just mark Fault" only exists while its sheet is open).
- **Verify, Care, Setup.**
  - Verify ticks persist.
  - Care ticks keep their date and share the battery tick with Setup.
  - Setup values travel in the backup file.
- **Diagnose.**
  - Diagnosis runs **live on input**, as today (Diagnose.svelte binds the field and derives the results, :12, :19-31). The tests fill the field and never press a button.
  - It accepts a multi-line pasted report and flags shared causes, such as two lamps in one column as a driver problem.
  - A bare digit is not a solenoid.
  - "Not recognised" shows for unknown codes.
  - Selectors and texts that stay: the field's label "Test report or display message" (:38; smoke.spec.ts:6, features.spec.ts:6, :16, :24); results as `.cards article` (features.spec.ts:18, :25) that are `article.comp[data-id]` with the name in an `h2` (smoke.spec.ts:7, :10); `.prov` with "Not recognised" (:66-72; features.spec.ts:19, :26); the `.causes` card with the heading text "Shared cause?" (:76-77; smoke.spec.ts:8) and its `matrix` link to `/lamps` or `/switches` (:88; features.spec.ts:10).
- **Matrix keys.** The arrow keys and Enter (`[data-cell="11"]` → ArrowRight/ArrowDown → Enter → `/switch/22`) are "contract, not polish".
- **Manual viewer.**
  - The "Text" button shows OCR in `.text pre`, and ArrowRight goes to the next page. Scans are cached on the device as they are opened.
  - PageViewer's zoom stays: the "Zoom out", "Fit" and "Zoom in" buttons (PageViewer.svelte:138-140), Rotate (:141), pinch, Ctrl + wheel, drag to pan, and the keys ← → pages, `+` `−` `0` zoom, `R` rotate, `T` text (hint at :196).
  - ManualSearch (the OCR full-text search, `aria-label="Search manual text"`, fetching `data/ocr-text.json`) stays on `/manual` (manual/index.astro:13) and on the viewer page (`manual/[doc]/[page].astro:40`).
- **Handbook.**
  - Menu-map links (`.mmap a`) resolve to `#pN-NN`.
  - The owner appendices show last, and component pages link to them.
  - The reader keeps `.pg-bar` per page (the first reads "Appendix A1" on `/handbook/appendix`, with no "Scan" link) and the appendix's `.prov.warn` "owner's own notes" (appendix.spec.ts:16-19).
  - The shot map is embedded after page 9 (`#pg-9 .shot-map`).
- **Parts.** The search is labelled "Search parts" and the rows sit in a `tbody`.
- **Map.**
  - Layers combine.
  - 17 shots (A–S without I and O).
  - Calibration: drag or arrow-nudge markers, the overlays, Copy JSON, the drafts.
  - Class names stay: `marker k-sw` / `k-lamp` / `k-coil` / `k-shot`, `.sel`.
- **PWA.** Offline precache and the update prompt (`src/pwa.ts`: registerType prompt), plus the `tafh-scans` runtime cache.
- **Accessibility.**
  - The skip link → `#main`, `aria-current`, the 2 px amber focus ring (offset 2).
  - Exactly one h1 per page (appendix.spec.ts:16 runs a strict `getByRole('heading', { level: 1 })`). Phase 5 sets the rule for the top bar.
  - `role=status` (and `<output>`) stays where it is today: SetupGuide.svelte:30, DeviceData.svelte:94, ShoppingList.svelte:52. The tests use a strict `page.getByRole('status')` on `/care`, `/setup` and `/shopping` (care.spec.ts:6-19; setup.spec.ts:7-26, :68-70; features.spec.ts:75), so anything rendered on every page (the shell, the tab badge, toasts) never uses `role=status` or `<output>`. The map's zoom readout may (it's `role=status` on ShellTablet/ShellDesktop), because it only renders on `/map`.
  - The light-theme link colour #a8440a is new (`--amber-ink`, Phase 1); today links use `var(--amber)` in both themes (base.css:17-20).
- **Tests.** All 9 vitest files and all 6 e2e specs stay green in both Playwright projects (phone-dark, desktop-light 1440×900).
  - A selector may change only in the phase that changes the markup it matches, keeping the test's intent, and the change must be noted as a deviation.
  - Selectors known to move:

    | Location | Selector | Moves in |
    |---|---|---|
    | smoke:16, :81 | marker names | Phase 2 |
    | smoke:19, :84 | `aside …` | Phase 2 |
    | smoke:68-74 | the "Toggle theme" button on `/` | Phase 3 |
    | shopping:31 | "Broken: Left Flipper Button" sits behind the Flipper J806 tab | Phase 7 |
    | care and setup specs | `getByRole('checkbox')`, if they become `role=switch` | Phase 9 |

## Phases

### [ ] Phase 1: tokens and map fit (priority 1)

- **Goal.** At 1× `/map` shows the whole playfield at every width, with floating controls. It ships inside today's shell, using CSS custom properties with fallbacks.
- **Boards.** MapFitSpec, Map, MapLight, MapZoom, ShellTablet, ShellDesktop, Components (§07), Motion.
- **Files.**
  - `src/styles/tokens.css` (edit)
  - `src/styles/base.css` (edit: link colour :17-20, the full-bleed `main`, the fixed `#sw-status`, the print block at `@media print` :363)
  - `src/layouts/Base.astro` (edit: interim `--topbar-h`, a `fullbleed` prop, `#sw-status` out of the footer)
  - `src/pwa.ts` (edit: the offline-ready line leaves after 4 s)
  - `src/pages/map.astro` (edit)
  - `src/components/PlayfieldMap.svelte` (edit)
  - `tests/e2e/map.spec.ts` (create)
- **Steps.**
  1. Settle Q1 first. The workshop-mode diff is not on `main`; it is uncommitted in the `addams-handbook-mobile-redesign-fc850f` worktree. Port only the values the owner keeps into tokens.css and base.css here; otherwise ignore it.
  2. tokens.css:
     - Add every new token in spec §1.1 to the dark block and to **both** light blocks. That includes `--amber-ink` (dark #ff8a3d, light #a8440a).
     - Add the radius, layout (§1.3), duration and ease (§10) tokens. The safe-area tokens fall back to 0, not the board's 47 and 34: `--safe-top: env(safe-area-inset-top, 0px)`, `--safe-bot: env(safe-area-inset-bottom, 0px)` (the viewport already has `viewport-fit=cover`, Base.astro:43).
     - Keep `--shadow`, `--r` and `--nav-h` for now (they retire in Phase 5).
  3. base.css:
     - Links: `a { color: var(--amber-ink) }` (was `var(--amber)`, base.css:17-20), so light-theme link text is #a8440a and dark stays #ff8a3d.
     - Print block (`@media print`, :363-372 resets only `--shadow`): also set `--amber-ink: #000`, `--shadow-1`, `--shadow-2` and `--shadow-sheet` to `none`, and `--raised`, `--cell`, `--sheet`, `--bar` to `#fff`. Hide the floating map controls and `#sw-status` (already listed at :385).
  4. Base.astro, interim bar heights (removed in Phase 5) and full bleed:
     - The inline script publishes the sticky `header.top` height as `--topbar-h`, using a ResizeObserver.
     - `--tabbar-h` stays 0 until Phase 4.
     - A `fullbleed` prop: `main` gets no `.wrap` padding and no max-width, and the footer (:92-99) isn't rendered. map.astro passes `fullbleed` instead of `wide`.
     - `#sw-status` (:98) moves out of the footer on every page and becomes a body-level fixed line: left and right 12, `bottom: calc(var(--tabbar-h) + var(--safe-bot) + 10px)`, `z-index` above the map controls, `pointer-events: none` except on its Reload button. pwa.ts keeps writing to it by id. The offline-ready text hides itself after 4 s (the Phase 11 dwell); the update text stays until Reload.
     - map.astro makes its h1 `sr-only`. It stays the page's only h1 (see Phase 5).
  5. PlayfieldMap: replace the `max-height: 78vh` scroller and the %-width canvas (:309, :491-497) with the fitted stage from spec §7.1:
     - The scroller's height is `calc(100dvh - var(--stage-top) - var(--tabbar-h) - var(--safe-bot))`. `--stage-top` is the scroller's document top (`getBoundingClientRect().top + scrollY`), re-measured when the header, the calibration card or the viewport resizes.
     - A ResizeObserver on the scroller supplies the stage size; the canvas is sized in px.
     - `overflow: hidden` at 1×, `.zoomed` above 1×.
  6. Controls (spec §7.3–7.4):
     - Below 1000: a floating right column with the Layers capsule (keep `role=group aria-label="Layers"` and a button named "Switches") and the Zoom capsule (Zoom in / Zoom out / "Fit whole playfield", `aria-disabled` at 1×).
     - From 1000: the glass layers list with counts, the zoom capsule, the "1×" readout and, at desktop width, the keyboard legend. Only one of the two layer controls is rendered at a time (strict locators). The list is **also** `role=group aria-label="Layers"`, made of `aria-pressed` `<button>`s named "Switches, 55 on the map", "Lamps, 60 on the map", "Solenoids and flashers, 33 on the map" and "Shots, 17 on the map" (ShellDesktop; take the counts from the data). smoke.spec.ts:85-90 runs at 1440×900 in desktop-light and clicks `group 'Layers' → button 'Switches'`.
     - The layer-source link (:252-258) leaves the toolbar and goes to the top of the aside, at every width, until Q25 places it. It must not sit under the stage, or the page scrolls.
  7. Zoom (spec §7.2):
     - Steps [1, 1.6, 2.4]; pinch 1–3 around the midpoint; double-tap steps at the tap point.
     - Fit centres at 1×.
     - Keys: `+` `−` `0` and Esc (deselect, drops `id=`) act when focus is anywhere inside the map component; the arrows pan when the stage itself has focus (it gets `tabindex=0`). The handler sits on the component's root, not on `window`, so the handbook embed never reacts to keys typed elsewhere. On `/map` only, a `window` listener also accepts them while focus is on `body` (never from an input or textarea).
     - Pan is clamped.
     - Timings: 250 and 300 emphasized; under reduced motion, jump.
  8. Markers (spec §7.5):
     - Fixed px at 1× (switch 12, lamp 10, coil 13, shot 16; the shot's 16 isn't drawn on any board, so Q5 confirms it), replacing the %-of-width `MARKER` sizes (:38, :344). The selected marker is 24 and shows its id; ids appear from 1.6× (keep `showLabels` for calibration).
     - Hit area, one mechanism: each marker `<button>` box is only its visible size. There is no enlarged box, no `::before` hit area and no wrapper, so no marker ever covers another marker's centre (Playwright clicks a marker at its own centre, smoke.spec.ts:15-18, :80-83). One `pointerup` handler on the canvas takes taps that land on no marker and selects the nearest visible marker whose centre lies within 22 px (screen px), which gives the 44 px area with the nearest centre winning. A drag (moved > 6 px) or a pinch never selects. In calibration, drags still start on the marker button itself (`dragStart`, PlayfieldMap.svelte:349).
     - The pulse runs once (Q21; keep the loop if the owner says so). No pulse under reduced motion.
  9. `.stage` grid: `minmax(0,1fr) var(--panel-w)` from 1000 (was 3fr/2fr from 900). From 1000 the aside column is capped at the stage height and scrolls inside (`overflow: auto`), so the list never lengthens the page. Below 1000 the existing aside stays under the stage until Phase 2, so phones still scroll the page in this phase.
  10. Handbook embed (`[section].astro:74`): fit to the container width, capped at the stage height, so it is never cropped (Q13).
  11. Check that `?calib=1` still drags, nudges and copies JSON.
- **Acceptance.**
  - At 390×844, 820×1180, 1180×820 and 1440×900, with `/map?layer=sw` scrolled to the top:
    - `.canvas` lies inside `.scroller` (±0.5 px), touches its top, and fills its width or its height (±1 px).
    - The aspect ratio is 1246:2702 (±0.5%).
    - The scroller's bottom is ≤ the viewport height.
    - At 1×, the scroller's scrollHeight ≤ clientHeight + 1.
  - At 1180×820 and 1440×900 the page doesn't scroll: `document.documentElement.scrollHeight ≤ innerHeight + 1`. (Below 1000 this check starts in Phase 2.)
  - `/map` has no `footer.foot`; `/` still has it, with the copyright paragraph.
  - Fit is `aria-disabled="true"` at 1×. After Zoom in, the canvas width is 1.6× the fitted width (±1), and Fit (or the `0` key) restores it.
  - `+` zooms the focused stage. Esc removes `id=` from the URL. On `/handbook/rules`, pressing `+` with focus outside the embed leaves the embed's canvas size unchanged.
  - Every button in the Layers and Zoom groups is ≥ 44×44.
  - Markers: clicking the markers named `/^32 Upper Right Jet/` and `/^K Bookcase/` by role and name selects that marker (`aria-pressed="true"`). A mouse click 20 px right of switch 32's centre, where no other marker is nearer, selects 32. A drag of 30 px from the same point selects nothing.
  - In the light theme a link's computed colour is `rgb(168, 68, 10)` (#a8440a); in the dark theme it is `rgb(255, 138, 61)`.
  - The existing smoke map tests pass unchanged: layers combine (also at 1440×900, with the wide list), 17 shots, the `#pg-9` embed.
  - Under emulated reduced motion, Fit and the zoom steps finish with no running transform animation.
  - The light theme's glass controls match MapLight by eye (desktop-light project).
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/map.spec.ts tests/e2e/smoke.spec.ts`. map.spec is new:
  - fit at the four sizes, using `page.setViewportSize`, and the no-page-scroll check from 1000;
  - Zoom in, Fit, the keys (and the embed ignoring them);
  - the 44 px control targets and the marker hit rule;
  - the link colour per theme;
  - reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`).

### [ ] Phase 2: map selection, the sheet and the side panel

- **Goal.** Selecting a part never pushes its details below the fold. Phones get the peek/expanded sheet with the drawing re-fitted above it; from 1000 the side panel holds the selected part and the parts list.
- **Boards.** MapPeek, MapPeekLight, MapExpanded, MapFitSpec, ShellTablet, ShellDesktop, Components (§03), Motion.
- **Files.**
  - `src/components/BottomSheet.svelte` (create)
  - `src/components/PlayfieldMap.svelte` (edit)
  - `src/pages/handbook/[section].astro` (edit :74: pass `embed`)
  - `tests/e2e/smoke.spec.ts` (edit :16, :19, :81, :84)
  - `tests/e2e/map.spec.ts` (edit)
- **Steps.**
  1. BottomSheet.svelte, both kinds per spec §8.2:
     - The map kind is a `section` with a grabber button (`aria-expanded`) and detents 96 and 416; a drag tracks the finger.
     - The modal kind is `role=dialog aria-modal`: it traps focus, returns focus on close, makes the page `inert`, closes on Esc, scrim or Close, and makes the parent recede.
     - Timings as in spec §10, including reduced motion.
  2. Below 1000, the selection sheet:
     - Selecting opens the map sheet at peek.
     - At 1× (below 600; for 600–999 [confirm on board MapFitSpec]) the drawing re-fits to stageH − 96 and the controls move 12 above the sheet.
     - Expanded, at 1×: the scroller is `overflow: hidden` and can't scroll, so the canvas moves with `transform: translateY(…)` until the part's centre sits mid-band in the uncovered band (spec §7.6: top −79.8 at 390×844). Above 1× the scroller scrolls instead (spec §7.1 `centre()`, with the uncovered band as the height). Collapse returns the translate to 0. The translate runs with the sheet's snap, 350 emphasized (board Motion: "Drawing, on expand y 0 to −79.8 … 350 emph"); under reduced motion it jumps inside the snap's 150 ms fade.
     - Expanded hides the controls (120 ms fade). Deselect re-fits.
     - Content per spec §7.6. Shots keep the shot-card content and `data-id`.
  3. Below 1000, the parts list leaves the page. The `aside` under the stage (PlayfieldMap.svelte:363-414) isn't rendered below 1000, or the page scrolls. Its content moves into a modal BottomSheet "All parts on the map" (large detent until the board gives one, spec §8.2):
     - Opened by an interim `.glass` 44×44 ibtn "All parts on the map" at the top of the right control column. Phase 5 moves it to the top bar.
     - At the top of the sheet: a search field "Find a part" that filters the rows by id or name as you type (Q28), then the layer-source link (Q25), then the provenance paragraph (`.prov`, :384-388).
     - Then the list per visible layer, one `h3` per layer as today. Picking a row closes the sheet and selects the part (the selection sheet opens at peek).
  4. From 1000, the panel `aside` "Selected part and parts on the map" (spec §7.7):
     - The selected part, with the status segmented control wired to the status store.
     - With nothing selected: today's empty card (the h2 "Playfield", the hint "Tap a marker on the drawing, or pick from the list." and the `.prov` paragraph, :381-389) takes the selected-part section.
     - The list of parts on the visible layers, headed by the same "Find a part" field as the phone sheet (Q28). The selected row is tinted **and** has `aria-current="true"`; nothing else in the list carries `aria-current`.
     - The layer-source link stays at the top of the aside (Phase 1).
  5. The handbook embed (`embed` prop, set by `[section].astro:74`):
     - It never calls `syncUrl()` (PlayfieldMap.svelte:137-143), so the reader's URL and hash stay as they are.
     - It never opens the selection sheet, the parts sheet or the panel. It keeps today's layout under the drawing: the selected card, then the list.
     - Its keys stay on its own root (Phase 1).
  6. The faults pill "N faults on the map", once Q27 settles its action. Otherwise leave it out and note that.
  7. Calibration card (spec §7.8):
     - Docked above the stage from 1000.
     - On phones, a non-modal sheet that doesn't re-fit (Q12 settles its height).
  8. Marker names per spec §7.5. Update the smoke regexes at :16 and :81, and the containers at :19 and :84, so each matches both the phone sheet and the panel. Keep the `data-id` hooks. The list rows keep their own names (`{id} {name}`), and the markers come first in the DOM, so `.first()` still picks the marker.
- **Acceptance.**
  - At 390×844, `/map?layer=sw&id=32`:
    - The region "Selected part, Switch 32" is visible and fully inside the viewport.
    - The canvas bottom is ≤ the sheet top, and the selected marker's centre is above the sheet.
    - The control column's bottom is 12 (±1) above the sheet's top, so Layers and Zoom stay in thumb reach.
  - The grabber toggles `aria-expanded` and the height 96 ↔ 416. When expanded at 1×, the marker's centre lies in the uncovered band (between the stage top and the sheet top) and the controls are hidden.
  - Deselect, or Esc, removes the sheet and `id=`, and the canvas returns to the full fit (Phase 1 check).
  - The page doesn't scroll at 390×844, 820×1180, 1180×820 and 1440×900, with and without `id=32`: `document.documentElement.scrollHeight ≤ innerHeight + 1`.
  - At 390×844, "All parts on the map" opens a dialog of that name. Typing "jet" in "Find a part" leaves only rows whose name contains "Jet". Picking "32 Upper Right Jet" closes the dialog, returns focus to the opener, and opens the peek sheet for 32.
  - At 1440×900, the panel is 420 wide beside the stage and holds `[data-id="32"]`; the row for 32 has `aria-current="true"`. Pressing Fault in the panel persists across a reload. `/map` with no `id=` shows the "Playfield" empty card and the `.prov` text in the panel.
  - On `/handbook/rules`, clicking shot K in the embed leaves `page.url()` unchanged and opens no `section[aria-label^="Selected part"]`; the shot card shows inside `#pg-9`.
  - Reduced motion: the sheet appears at its detent with no slide, the expanded translate jumps, and there is no pulse.
  - All smoke tests pass in both projects.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/map.spec.ts tests/e2e/smoke.spec.ts`. New checks: sheet geometry and thumb reach, expand and collapse, deselect re-fit, no page scroll at the four sizes, the parts dialog and its filter, panel width and `aria-current`, the embed's URL, reduced motion.

### [ ] Phase 3: hubs (`/tables`, `/workshop`), the list vocabulary, Appearance

- **Goal.** The two new tab roots exist, built from the list-row, group and segmented styles. The theme control moves into Workshop → Appearance. They are reachable from today's nav strip.
- **Boards.** Tables, Workshop, Components (§04, §05), Native (theme), Rationale (§04, §05).
- **Files.**
  - `src/styles/base.css` (edit: spec §8.3, §8.4, §8.6, §8.7)
  - `src/pages/tables.astro` (create)
  - `src/pages/workshop.astro` (create)
  - `src/lib/verify-store.ts` (create: `KEY = 'tafh:verify'` and `loadVerifyTicks()`, moved out of verify-check.ts:5-15)
  - `src/lib/verify-check.ts` (edit: import them; it keeps its self-run `initVerifyChecks()` at :54, so the hub must not import verify-check.ts)
  - `src/layouts/Base.astro` (edit: add Tables and Workshop to the interim NAV; remove `#theme-toggle` at :75-77 and its inline script at :100-115)
  - `src/styles/base.css` (edit: also drop `#theme-toggle` from the print list, :384)
  - `tests/e2e/smoke.spec.ts` (edit :68-74)
  - `tests/e2e/hubs.spec.ts` (create)
- **Steps.**
  1. List and group, segmented, toggle, pill and chip CSS per the spec.
  2. `/tables` per spec §9.5:
     - Counts come from `src/data`.
     - "Recently viewed" stays hidden until Phase 7 fills it.
     - What the "Search tables" field filters isn't drawn [confirm on board Tables].
  3. `/workshop` per spec §9.14:
     - The counts come from the status store (`groupFaults`), `loadVerifyTicks()` and `setupItems()` (src/lib/model/setup.svelte.ts:55).
     - "Device data" links to its current home until Q7 settles.
     - "Install app" stays hidden until Phase 11.
     - The Version comes from package.json.
     - The last group ends with a row "About this handbook". It opens a modal BottomSheet (Phase 2) holding the footer's copyright paragraph (Base.astro:93-97), word for word, and the Version.
     - No count or badge on the hub uses `role=status` or `<output>` (Keep → Accessibility).
  4. Appearance: a segmented group named "Toggle theme" with System / Dark / Light.
     - System removes `tafh:theme`; Dark or Light stores it.
     - The head script (Base.astro:53-54) is unchanged. Q3 decides what a missing key means.
     - It sits in the page, so print hides it with the other `.btn`s and `.no-print` (base.css:379-389).
  5. Move the smoke theme test to `/workshop`: choose the opposite palette and assert the body background changes.
- **Acceptance.**
  - Every row on both hubs is an `<a>` or a `<button>` inside a `<ul>`, and is ≥ 44 tall.
  - Mark switch 32 Fault on `/switch/32`, then open `/workshop`: the Shopping list row shows 1. Tick one box on `/verify`, then open `/workshop`: the Verify row shows 1.
  - Choosing Light sets `data-theme="light"` and `tafh:theme=light`, and the choice survives a reload. System removes the key.
  - "About this handbook" opens a dialog of that name containing "Williams Electronics Games / Midway". Esc closes it and focus returns to the row.
  - `grep -rn 'theme-toggle' src` returns nothing.
  - After `pnpm build`, `grep -c 'tables\.html\|workshop\.html' dist/sw.js` is ≥ 1: both hubs are precached (the `**/*.html` glob, astro.config.ts:44).
  - The existing care, setup and features tests still pass (their strict `getByRole('status')`).
  - No horizontal scroll at 390 wide. Both themes match the boards by eye.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/hubs.spec.ts tests/e2e/smoke.spec.ts tests/e2e/care.spec.ts tests/e2e/setup.spec.ts tests/e2e/features.spec.ts`. New checks: row heights, the badge count sources (status and verify), the theme persistence, the About dialog.

### [ ] Phase 4: navigation shell (tab bar, rail, sidebar)

- **Goal.** The 13-link strip is replaced by the five tabs at every width.
- **Boards.** Components (§01), Rationale (§01–§04, §07), ShellTablet, ShellDesktop, Native (safe areas).
- **Files.**
  - `src/lib/nav.ts` (create: the tabs, the nav key → tab map, the sidebar sub-rows)
  - `src/layouts/Base.astro` (edit)
  - `src/components/TabBadge.svelte` (create: reads the status store and `groupFaults`)
  - `tests/e2e/shell.spec.ts` (create)
- **Steps.**
  1. nav.ts per spec §6.1. ComponentPage's `nav={listPath}` maps to Tables.
  2. The tab bar below 600 (spec §6.2), the rail for 600–1279 (§6.3) and the sidebar from 1280 (§6.4), all as `nav aria-label="Sections"` with `aria-current="page"`.
     - The tab bar pads with `env(safe-area-inset-bottom)`.
     - `--tabbar-h` becomes 49 below 600 and 0 above.
  3. The badge: "Workshop, N on the shopping list" (Q6 decides whether it counts rows or units), plus the sidebar's count pill.
  4. Reselecting the current tab goes to its root (when on a pushed page), scrolls to the top and focuses the h1.
  5. The main content gets bottom padding of `--tabbar-h` plus the safe area. `#sw-status` sits 10 above the bar. Print hides every navigation form.
  6. Keep today's header brand row and QuickSearch until Phase 5. The sidebar search depends on Q10.
- **Acceptance.**
  - At 390×844: five links in the order Diagnose, Map, Tables, Handbook, Workshop, each ≥ 44 tall.
    - `/switch/32` marks Tables current; `/shopping` marks Workshop; `/manual/ops/25` marks Handbook.
  - At 820×1180 and 1180×820 the rail is 80 wide and there is no tab bar. At 1440×900 the sidebar is 256 wide and there is no rail.
  - After marking switch 32 Fault, the Workshop link's name is "Workshop, 1 on the shopping list".
  - The last row of `/parts` scrolls fully clear of the tab bar. No horizontal scroll at 390.
  - The Phase 1 map-fit checks still pass, now with the tab bar and rail widths in the stage. So does the Phase 2 check that `/map` never scrolls the page at the four sizes: the stage height subtracts the new `--tabbar-h`.
  - `#sw-status` (forced visible in the test) sits 10 above the tab bar at 390×844 and doesn't cover any tab.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/map.spec.ts`. New checks: which navigation form shows per width, `aria-current` per route, the badge name, 44 px tabs.

### [ ] Phase 5: top bar, back links and token migration

- **Goal.** The board's top bar on every page:
  - a large title that collapses, on tab roots;
  - a compact bar with a back link, on pushed pages;
  - a compact bar only, on Map.
  The old header row and the interim tokens go.
- **Boards.** Components (§02, §07), Rationale (§04), Map, ShellTablet, ShellDesktop, Switch, Motion (large title), Native (safe areas).
- **Files.**
  - `src/layouts/Base.astro` (edit: header props for title, back and large; remove the brand row and the interim script)
  - `src/layouts/ComponentPage.astro` (edit: :40 crumbs → back link)
  - `src/styles/tokens.css` (edit: `--topbar-h` per breakpoint; drop `--nav-h`, `--shadow`, `--r`)
  - `src/styles/base.css` (edit: :8 `scroll-padding-top`; :144 `--on-amber`; the `:hover` rules at :21, :139, :214)
  - `src/pages/handbook/[section].astro` (edit: :130, the sticky `.side` top)
  - `src/pages/map.astro` (edit: title, ibtns)
  - `src/components/PlayfieldMap.svelte` (edit: remove the interim ibtn from the control column)
  - `src/pages/index.astro` (edit: its in-page h1 gives way to the large title; mount QuickSearch until Phase 6)
  - `src/pages/handbook/index.astro`, `src/pages/tables.astro`, `src/pages/workshop.astro` (edit: their in-page h1 gives way to the large title)
  - `src/pages/manual/[doc]/[page].astro` (edit: `h1="bar"`, back link)
- **Steps.**
  1. The top bar per spec §6.5. The collapse is linked to scroll over 52 px; under reduced motion the titles swap at 52.
  2. One h1 per page, set by a Base prop `h1` with three values:
     - `'large'` on the tab roots `/`, `/tables`, `/handbook` and `/workshop`: the large title is the h1, the compact title is `aria-hidden`, and the page's own h1 is removed.
     - `'page'` (the default) on every other page that has its own h1 today (`grep -rln '<h1' src/pages` lists 15 files; all but index.astro, handbook/index.astro and map.astro). Among them is handbook/[section].astro, whose h1 appendix.spec.ts:16 reads as "Appendix…". The top bar's title is `aria-hidden` and never a heading.
     - `'bar'` on pages with no h1 today (ComponentPage, `manual/[doc]/[page].astro`) and on `/map` (its sr-only h1 goes): the compact title is the h1. On `/map` its accessible text is "Playfield map" at every width; phones show the word "Map" in an `aria-hidden` span.
  3. Static parents from the Routes table: `/switch/[id]` → `/switches`, `/lamp/[id]` → `/lamps`, `/coil/[id]` → `/coils`; the lists → `/tables`; the reader → `/handbook`; the viewer → `/manual`; the Workshop pages → `/workshop`. Tab-aware back labels such as "Results" wait for Phase 12.
  4. Map's top bar (Map, ShellTablet, ShellDesktop): the ibtn "Find a part" at every width, and "All parts on the map" below 1000 only (it opens Phase 2's parts sheet; from 1000 the panel is the list). "Find a part" opens the parts sheet with its field focused below 1000, and focuses the panel's field from 1000 (Q28). The interim ibtn leaves the control column.
  5. Safe areas: the top bar pads with `var(--safe-top)`. Offsets that sat under the old header use it too:
     - `scroll-padding-top: calc(var(--safe-top) + var(--topbar-h) + 12px)` (base.css:8);
     - `top: calc(var(--safe-top) + var(--topbar-h) + 40px)` for the reader's sticky side column (`[section].astro:130`).
  6. Hover: every `:hover` rule (base.css:21, :139, :214, and any new one) moves inside `@media (hover: hover)`, so a tap on a phone never leaves a row or button tinted.
  7. A mechanical rename: `var(--shadow)` → `var(--shadow-1)` in 2 files and `var(--r)` → `var(--r-xs)` in 8 files. List them with `grep -rl`. Then `--nav-h` → `--topbar-h`.
- **Acceptance.**
  - On `/`, `/tables`, `/handbook` and `/workshop` the h1 is the large title. After scrolling 52 px, the compact title and the hairline show.
  - Every built page has exactly one h1: `for f in $(find dist -name '*.html'); do n=$(grep -o '<h1' "$f" | wc -l); [ "$n" -eq 1 ] || echo "$f $n"; done` prints nothing. appendix.spec passes unchanged.
  - `/switch/32` shows a back `<a href>` to `/switches`. Every pushed route in the table has a back link.
  - `grep -rn "nav-h\|var(--shadow)\|var(--r)" src` returns nothing.
  - `grep -n ':hover\|@media (hover' src/styles/base.css` shows each `:hover` after a `@media (hover: hover)` line, inside its block.
  - The skip link is still the first focusable element and targets `#main`.
  - `/handbook/menus` menu-map anchors land below the top bar (the element's top is ≥ the bar's bottom), at 390×844 and at 1440×900. Playwright's safe areas are 0, so the test also asserts that the root's computed `scroll-padding-top` equals the header's rendered height + 12 (±1): the formula carries the notch, not a fixed number.
  - The top bar pads with `var(--safe-top)`; the header is 44 / 50 / 56 plus that, per breakpoint.
  - `/map` shows "Find a part" at 390 and at 1440, and "All parts on the map" only at 390.
  - The Phase 1 and Phase 2 map checks pass (fit, and no page scroll at the four sizes).
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/map.spec.ts tests/e2e/smoke.spec.ts tests/e2e/appendix.spec.ts`. New checks: the title collapse (scroll, then read the compact title's opacity), one h1, back links, anchor offsets, reduced motion.

### [ ] Phase 6: Diagnose home, results and search (the entry point)

- **Goal.** `/` becomes the Diagnose home, with the results and search states.
- **Boards.** Main, MainLight, DiagnoseResults, DiagnoseResultsLight, DiagnoseSearch, Components (§06), Rationale (§03, §05).
- **Files.**
  - `src/pages/index.astro` (edit)
  - `src/components/Diagnose.svelte` (edit)
  - `src/components/QuickSearch.svelte` (edit: becomes the search state of the Diagnose field)
  - `src/components/ComponentCard.svelte` (edit: the card anatomy, spec §8.5)
  - `src/lib/model/recent.svelte.ts` (create; Q16 sets the policy)
  - `tests/e2e/diagnose.spec.ts` (create)
- **Steps.**
  1. Home per spec §9.1: quick links; Recent, or the four examples on first run; the field docked low with Paste and Diagnose.
  2. Today's home links move before they leave `/` (index.astro:15-40), each to the hub row the boards draw for it:
     - `handbook/tests` and `handbook/errors` → `/handbook` (Test menu 1-15–1-19; Error messages & codes 1-44–1-45, spec §9.10);
     - `fuses` → `/tables` (Boards: Fuses, spec §9.5);
     - `verify`, `setup`, `care` → `/workshop` (spec §9.14);
     - `map?layer=sw|lamp|coil|shot` → the Map tab and its layer toggles.
     If a hub row isn't built yet, keep that link on `/` until it is.
  3. Diagnosis stays live on input (Keep → Diagnose). "Diagnose" doesn't compute anything new: it records the entry in Recent, moves focus to the results heading and scrolls them into view. Enter in a single-line field does the same.
  4. Recent (the Phase 6 store; Q16 sets how many and which key): an entry is recorded when Diagnose or Enter is pressed, or when the field loses focus with at least one recognised code. Each entry keeps the input, the counts ("1 switch · 1 marked Fault") and the date. The same normalised input moves to the top instead of repeating. Choosing an entry refills the field.
  5. Results per spec §9.2.
     - Keep `article.comp[data-id]` and the h2 name.
     - Keep the shared-cause and "Not recognised" outputs.
     - How Share results shares isn't drawn [confirm on board DiagnoseResults].
  6. Search per spec §9.3. The trigger, exactly: the field switches to search when its input is one line, contains **no digit**, and has at least 2 letters. Anything else stays a live diagnosis, so "row 5" still says "Not recognised" (features.spec.ts:22-27) and "Check Switch 32" still diagnoses. Q20 decides whether parts and OCR are in scope.
  7. Remove QuickSearch from the top bar on phones. Keep `?q=`.
- **Acceptance.**
  - At 390×844 with fresh storage, the quick links, the examples, the field and the Diagnose button are all visible without scrolling, and the field sits above the tab bar. The Diagnose button's centre is in the lower half of the viewport (thumb reach).
  - Tapping the example "32 68 F1 F3" gives 4 `article.comp` and the J806 shared-cause card, with no button pressed.
  - Fill "32 68", press Diagnose, reload: "32 68" is the first Recent entry. Filling the field without pressing anything and without leaving it records nothing.
  - Typing "flipper" shows the search chips and grouped results. Cancel restores the home. "row 5" and "Check Switch 32" never show the search state.
  - `/handbook` links to `handbook/tests` and `handbook/errors`, `/tables` to `fuses`, and `/workshop` to `verify`, `setup` and `care` (one `a[href$=…]` each).
  - smoke "diagnose resolves…" and features :4, :13, :22 pass unchanged.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/diagnose.spec.ts tests/e2e/features.spec.ts tests/e2e/smoke.spec.ts`.

### [ ] Phase 7: Tables screens and component detail

- **Goal.** The switch matrix segments, the detail page anatomy, the Show-on-map sheet, the Add-to-list sheet (if Q6 says yes) and Recently viewed.
- **Boards.** SwitchMatrix, SwitchMatrixLight, Switch, SwitchMapSheet, SwitchShop, Tables, Components (§04–§06).
- **Files.**
  - `src/pages/switches.astro` (edit: a tablist)
  - `src/components/Matrix.svelte` (edit: the selected-cell card)
  - `src/layouts/ComponentPage.astro` (edit: spec §9.7)
  - `src/components/StatusRow.svelte` (edit: the status segmented control)
  - `src/pages/tables.astro` (edit: Recently viewed)
  - `tests/e2e/shopping.spec.ts` (edit :31: open the Flipper J806 tab first)
  - `tests/e2e/tables.spec.ts` (create)
- **Steps.**
  1. The tablist "Switch matrix view": Matrix / Dedicated J205 / Flipper J806, with `aria-selected`, `aria-controls` and the arrow keys.
     - All three panels stay in the DOM, rendered at build time; the inactive ones carry `hidden`. `fault-check.ts` runs once on import (switches.astro:103) over every `input.fault-check`, so a tick in a hidden panel still loads its stored state.
     - The J205 and J806 tables keep their "Broken" ticks and markup (Keep → Tables pages).
     - shopping.spec.ts:31 ticks "Broken: Left Flipper Button", which now sits in the hidden J806 panel, and `.check()` needs it visible. Add `await page.getByRole('tab', { name: 'Flipper J806' }).click();` before it and note the deviation (Keep → Tests).
  2. The matrix cell card: "Open" and "Show on map". The arrow keys and Enter are unchanged.
  3. Detail anatomy per spec §9.7. Q18 decides whether the prev/next pager stays. It keeps the `.notes` block, the "Service log" list and a single Fault / OK status control (Keep → Component pages).
  4. "Show on map" opens a modal sheet at the large detent with "Open in Map" → `/map?layer=sw&id=32` and "Manual page".
  5. "Add to list" opens the SwitchShop sheet only if Q6 says yes. Otherwise it marks Fault, as today. Inside the sheet, "Just mark Fault" exists only while the sheet is open.
  6. Record Recently viewed using the Phase 6 store.
- **Acceptance.**
  - The tablist arrow keys move `aria-selected` and show the matching panel.
  - On a fresh load of `/switches`, `input.fault-check` counts every tick in all three panels (the count before the change, taken with the same locator).
  - smoke "switch matrix supports keyboard navigation" and "status persists" pass unchanged. shopping.spec passes with only the :31 tab click added.
  - `/switch/32` has exactly one visible button containing "Fault" and one named "OK", a `getByLabel('Service log')` list, and the `.notes` block with its appendix links.
  - Pressing the chosen status again clears it (`aria-pressed="false"` after a reload).
  - Show on map is a `role=dialog`; Esc returns focus to its button; the parent is `inert` while it is open.
  - Visiting `/switch/32` puts it first under Recently viewed on `/tables`.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/tables.spec.ts tests/e2e/smoke.spec.ts tests/e2e/shopping.spec.ts tests/e2e/appendix.spec.ts tests/e2e/features.spec.ts`.

### [ ] Phase 8: Handbook, Manuals, Parts

- **Goal.** The Handbook tab root with its segmented links, the reader toolbar, the manual viewer toolbar with its Go to page sheet, and the Parts restyle.
- **Boards.** HandbookHome, HandbookReader, ManualViewer, Parts, Components (§04, §05).
- **Files.**
  - `src/pages/handbook/index.astro` (edit)
  - `src/pages/manual/index.astro` (edit: the segmented links; ManualSearch stays at :13)
  - `src/pages/parts.astro` (edit: the segmented links)
  - `src/components/HandbookToc.svelte` (edit)
  - `src/pages/handbook/[section].astro` (edit: the bottom toolbar)
  - `src/pages/manual/[doc]/[page].astro` (edit: ManualSearch stays at :40)
  - `src/components/PageViewer.svelte` (edit: the toolbar, the zoom capsule and the Go to page sheet)
  - `src/components/PartsList.svelte` (edit)
  - `tests/e2e/handbook.spec.ts` (create)
- **Steps.**
  1. Segmented links Handbook / Manuals / Parts with `aria-current`, on `/handbook`, `/manual` and `/parts`. They're links (a `nav`), not a tablist.
  2. HandbookHome per spec §9.10. Continue reading follows Q16's policy.
  3. The reader toolbar per spec §9.11. Q17 decides whether it pages by page or by section. `.pg-bar`, `.prov.warn` and `#pg-9 .shot-map` stay (Keep → Handbook).
  4. Viewer per spec §9.12:
     - "97 / 124" opens the Go to page sheet.
     - "Rotate page" in the toolbar replaces today's Rotate button (PageViewer.svelte:141), same action.
     - The board draws no zoom buttons, but zoom stays (Keep → Manual viewer). "Zoom out", "Fit" and "Zoom in" (:138-140) move into a `.glass` zoom capsule, `role=group aria-label="Zoom"`, 44 px buttons, floating bottom-right over the scan and above the toolbar (the Map's capsule, spec §7.3) [confirm on board ManualViewer].
     - Pinch, Ctrl + wheel, drag to pan, and the keys (← → pages, `+` `−` `0` zoom, `R` rotate, `T` text) are unchanged. The key hint (:196) stays where there is a keyboard: from 1000, or under `(hover: hover)`.
     - The "Text" button and ArrowRight are unchanged.
     - ManualSearch ("Search manual text") stays on the viewer page, below the scan and the contents, and on `/manual` under the segmented links.
  5. Parts per spec §9.13, keeping the table, the "Search parts" label and the `tbody` rows.
- **Acceptance.**
  - Go to page: entering 30 and pressing Go lands on `/manual/ops/30`. Esc closes the sheet and returns focus.
  - The segmented link for the current route has `aria-current="page"`.
  - On `/manual/ops/25`: "Zoom in" makes the scan wider than at Fit, and "Fit" and the `0` key restore the fitted width; "Rotate page" and the `R` key rotate it; every button in the zoom capsule is ≥ 44×44.
  - `getByLabel('Search manual text')` finds the field on `/manual` and on `/manual/ops/25`.
  - smoke "manual viewer…", "parts search…", "handbook menu map links…", appendix.spec and the `#pg-9` embed all pass unchanged.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/handbook.spec.ts tests/e2e/smoke.spec.ts tests/e2e/appendix.spec.ts`.

### [ ] Phase 9: Workshop screens

- **Goal.** The Shopping list per its board (groups, swipe to Fixed, Copy and Share). Verify, Care, Setup and Device data move into the grouped-list styles; their bodies aren't drawn (Q19).
- **Boards.** Shopping, Workshop, Components (§05).
- **Files.**
  - `src/components/ShoppingList.svelte` (edit)
  - `src/pages/shopping.astro` (edit)
  - `src/components/DeviceData.svelte` (edit; moves if Q7 says so)
  - `src/pages/verify.astro`, `src/pages/care.astro`, `src/components/SetupGuide.svelte` (edit, styles only)
  - `tests/e2e/shopping.spec.ts` (edit only if markup forces it)
- **Steps.**
  1. Shopping per spec §9.15, within Keep → Shopping list:
     - "N parts to order".
     - Groups by kind, each a `section.grp` with an `<h2>` titled from `KIND_TITLE`: **Lamps**, not the board's "Bulbs".
     - Each row reads "1 × PART · {itemRef} {name}", and the link text stays `{itemRef} {name}` (the board's "32 Upper Right Jet" is "S32 Upper Right Jet" here, shopping.ts:31-33).
     - Swiping left reveals "Fixed" (88 wide). The "Fixed: {name}" button stays in every row, so the swipe is never the only way. A mostly vertical drag scrolls the page and never reveals it.
     - "Copy as text", "Show text" and "Share". The export text is unchanged. How Share works isn't drawn [confirm on board Shopping].
     - The empty state keeps "Nothing marked Fault yet".
     - The "Service kit" section (shopping.astro:50-96) stays below the list, restyled as a group.
  2. Destructive rows in `--bad`. "Clear all" keeps its second tap.
  3. Toggles become `role=switch` only where the board shows them. Update the care and setup selectors in the same change and note it.
- **Acceptance.**
  - shopping.spec, care.spec, setup.spec and the features device-data and verify tests pass.
  - A swipe on a row, or its Fixed button, clears that fault, and the Workshop badge drops by one.
  - With L11 marked Fault, `/shopping` shows the heading "Lamps", and "Show text" gives `Lamps\n1 × #555 (24-8768): L11 Thing Multiball`.
  - The "Service kit" section is still on `/shopping`, after the list.
  - Every row and toggle is ≥ 44 tall.
  - Manual check on a phone, which the owner does: the swipe works one-handed with the thumb, a vertical scroll through the list never opens a row, and Copy / Share sit within thumb reach at the bottom of the list.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/shopping.spec.ts tests/e2e/care.spec.ts tests/e2e/setup.spec.ts tests/e2e/features.spec.ts`.

### [ ] Phase 10: install surface (meta, icons, manifest, splash, standalone)

- **Goal.** When installed it looks like an app: the right icons, the splash, the status bar, safe areas and orientation.
- **Boards.** Native.
- **Files.**
  - `src/layouts/Base.astro` (edit: meta :43-49)
  - `astro.config.ts` (edit: manifest icons :35-38, orientation)
  - `scripts/icons.mjs` (edit: icon-180, maskable-512 with the art inside the centre 80%, the 1170×2532 startup image)
  - `public/icons/*` (generated with `pnpm icons`)
- **Steps.**
  1. Add `apple-mobile-web-app-status-bar-style` black-translucent and `apple-mobile-web-app-title` "TAF Handbook". Point `apple-touch-icon` at `icons/icon-180.png`. Every new href goes through `href()` (Keep → Base path).
  2. The startup image: `<link rel="apple-touch-startup-image" href={href('icons/startup-1170x2532.png')} media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)">`. iOS shows it only when the media query matches the device, so it's exactly 1170×2532. Other iPhones get no splash, which is acceptable.
  3. icons.mjs:
     - icon-180: a square with the #0e0b10 background to the edges and no transparency. iOS rounds the corners itself, and transparent corners turn black; the board's radius 40 is iOS's mask, not part of the file.
     - maskable-512: the art inside the centre 80% on the same background.
     - The startup image per spec §11 (Splash). sharp renders SVG text with the fonts installed on the machine, not the web fonts, so draw the name in IM Fell English SC as outlines in the SVG (converted once from `public/fonts/im-fell-english-sc-latin-400-normal.woff2`). Check the output by eye.
  4. Manifest: `orientation: 'any'`; the maskable entry points at `icons/maskable-512.png`. `start_url` and `scope` stay `scope` (astro.config.ts:9, :30-31), so they follow BASE_PATH.
  5. Audit the safe areas: the top bar, the tab bar and the page side padding use `env()` per spec §11.
- **Acceptance.**
  - `dist/index.html` carries both apple meta tags, `icon-180.png` and the startup image with its `media`.
  - `dist/manifest.webmanifest` has `orientation: "any"` and a separate maskable icon.
  - The icons exist at 180 (opaque: `sharp(...).stats()` reports `isOpaque: true`) and 512 (maskable), and the startup image is 1170×2532.
  - With `BASE_PATH=/TheAddamsFamilyHandbook/ pnpm build`, the manifest's `start_url` and `scope` are both `/TheAddamsFamilyHandbook/`, and the gauntlet's base-path check finds no root-relative `href` or `src`.
  - Manual check on an iPhone, which the owner does:
    - Installed, it opens standalone with no browser bar, and the splash shows on a 390×844 phone.
    - The top bar clears the notch, and the tab bar clears the home indicator.
    - The status-bar clock is legible in the light theme; the board warns it stays white.
- **Verify.** The gauntlet, plus (the HTML is one line, so count matches with `grep -o`, not `grep -c`):
  - `grep -o 'apple-mobile-web-app-[a-z-]*' dist/index.html | sort -u` → exactly `apple-mobile-web-app-status-bar-style` and `apple-mobile-web-app-title`;
  - `grep -o 'rel="apple-touch-startup-image"' dist/index.html | wc -l` → 1;
  - `grep -oE '"orientation": ?"any"' dist/manifest.webmanifest | wc -l` → 1;
  - `grep -oE '"(start_url|scope)": ?"[^"]*"' dist/manifest.webmanifest` after the BASE_PATH build → both `/TheAddamsFamilyHandbook/`.

### [ ] Phase 11: system states (toasts, install sheet, offline scans, pull-to-refresh)

- **Goal.** The offline, update, install and scan-not-cached states as drawn.
- **Boards.** Native, Install, Update, Workshop.
- **Files.**
  - `src/pwa.ts` (edit)
  - `src/layouts/Base.astro` (edit: mount Toast once; remove `#sw-status`)
  - `src/styles/base.css` (edit: drop `#sw-status` rules, hide the toast host in print)
  - `src/components/Toast.svelte` (create)
  - `src/components/InstallSheet.svelte` (create)
  - `src/components/PageViewer.svelte` (edit: the scan-not-cached state)
  - `src/pages/workshop.astro` (edit: the Offline and Install rows, pull-to-refresh)
  - `tests/e2e/pwa.spec.ts` (create)
- **Steps.**
  1. Toasts per spec §8.8:
     - Offline ready leaves after 4 s.
     - Update ready stays until Reload.
     - One at a time, Update winning, 10 above the tab bar.
     - They replace the fixed `#sw-status` line from Phase 1. pwa.ts dispatches a `tafh:toast` event (`{ kind: 'offline' | 'update' | 'info', text }`) and Toast.svelte, mounted once in Base.astro, listens for it; the tests dispatch the same event.
     - The toast host is a `div` with `aria-live="polite"` and `aria-atomic="true"`, and **no** `role=status` and no `<output>`: it renders on every page, and `/care`, `/setup` and `/shopping` run a strict `getByRole('status')` (Keep → Accessibility).
     - The host has `pointer-events: none`; only the toast's own buttons (Reload) take `pointer-events: auto`, so a toast never blocks the tab bar or the map controls under it.
  2. The Install sheet per spec §9.16, using `beforeinstallprompt` where it fires (Q22); the iPhone footer text otherwise.
  3. Scan not cached: the inline message plus "Show the text".
  4. Pull-to-refresh on `/workshop` only. It checks for an update and ends in the Update toast or in "The handbook is up to date." for 4 s.
- **Acceptance.**
  - Two toasts requested together show only one, and Update wins.
  - The offline toast is gone after 4 s. The update toast stays until Reload.
  - With an update toast showing on `/care`, `/setup` and `/shopping`, `page.getByRole('status')` still resolves to exactly the one element it found before.
  - With an update toast showing at 390×844, a click on the Workshop tab under the toast's host (outside the toast) still navigates.
  - With the context offline (`context.setOffline(true)`), an uncached scan page shows the message and "Show the text" reveals the OCR.
  - The Install sheet is a `role=dialog` at ≈470, closes with Esc, and returns focus.
  - Pull-to-refresh exists on `/workshop` and nowhere else.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/pwa.spec.ts tests/e2e/care.spec.ts tests/e2e/setup.spec.ts tests/e2e/shopping.spec.ts tests/e2e/features.spec.ts`. Build the preview for the service-worker checks; the dev server has none (`devOptions.enabled: false`).

### [ ] Phase 12: motion and navigation continuity

- **Goal.** Push, pop, swipe back and the tab cross-fade per Motion. Each tab keeps its stack, scroll, and the Map's zoom and selection. Reduced motion is honoured everywhere.
- **Boards.** Motion, Components (§01, §03), Rationale (§04).
- **Files.**
  - `src/layouts/Base.astro` (edit)
  - `src/lib/nav-state.ts` (create: per-tab stack, scroll and map state)
  - `src/styles/base.css` (edit: transitions)
  - `astro.config.ts` (edit, only if Q11 picks ClientRouter)
  - `tests/e2e/motion.spec.ts` (create)
- **Steps.**
  1. Start with a spike: settle Q11 (ClientRouter vs cross-document view transitions vs CSS only). The choice must keep the service worker's offline navigation and island hydration (`tests/e2e/helpers.ts` gotoHydrated).
  2. Push and pop timings per spec §10. The back link becomes tab-aware (e.g. "Results" when opened from Diagnose).
  3. Swipe back on every pushed view: commit past 35% or above 500 px/s, otherwise spring back. The back link still works.
  4. The tab cross-fade and state restore.
- **Acceptance.**
  - Open `/switch/32` from Tables, switch to Map and select 32 at 1.6×, then return to Tables: `/switch/32` is back at the same scroll. Return to Map: 1.6× with 32 still selected.
  - A left-edge drag past 35% returns to the parent; a short drag springs back.
  - With `reducedMotion: 'reduce'`, `document.getAnimations()` during a push holds only opacity animations of 150 ms or less.
  - With the context offline after one online visit, all five tabs still open.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/motion.spec.ts`.

## Open questions for the owner

Each question ends with the phase it blocks.

1. **The uncommitted workshop-mode slice** (`mobile-redesign.md`, plus the diffs in `tokens.css` and `base.css`: `--tabs-h`, `--type-base`, the `data-mode='workshop'` blocks; uncommitted in the `addams-handbook-mobile-redesign-fc850f` worktree, not on `main`). It conflicts with the Workshop tab and uses another tab set. Discard it, or keep `--type-base` and the higher-contrast values? *Phase 1.*
2. Tab 5: Workshop (the default, as the board recommends) or Shopping list? *Phase 4.*
3. **Theme default.** Native says "Dark is the default" and also "System clears it". Today no stored key follows the OS. Which should no key mean? *Phase 3.*
4. **The data-find bar.** `appendix-integration.md:50` says 0; the last green run recorded 8 (`grep -ro 'data-find=' dist --include=*.html | wc -l`; `grep -c` under-counts the compressed HTML). Which is the target? *Every phase.*
5. Marker sizes: above 1×, constant or growing (MapZoom draws 26 px at 2.4×)? And the shot marker's 16 px at 1× isn't drawn on any board: confirm it. *Phase 1.*
6. SwitchShop's quantity and part-or-assembly choice change the derived shopping list into stored lines, and change what the badge counts (rows or units). Build it, or keep "Add to list" = mark Fault? *Phases 4 and 7.*
7. Device data: its own page, a section on `/workshop`, or stay on `/shopping` (where features.spec opens it)? *Phases 3 and 9.*
8. `/coils`: the three Tables rows (Solenoids & flashers, Flipper coils, GI). Anchors on `/coils`, or separate pages? *Phase 3.*
9. `/404`: inside the new shell, or the TILT page alone? *Phase 4.*
10. The sidebar search field from 1280: is it QuickSearch, a link to Diagnose search, or nothing? *Phase 4.*
11. Page transitions: Astro ClientRouter (unproven here; it touches the service worker and hydration), cross-document view transitions, or CSS only? *Phase 12.*
12. Calibration's medium detent on phones: ≈470 like the modal? *Phase 2.*
13. The height of the handbook embed stage (`#pg-9`). *Phase 1 (an interim default is set).*
14. Body text 16 (today) or 17/24 (kit)? *Phase 5.*
15. Light-theme contrast on `--ground`: `--ok` 4.19, `--warn` 3.46 and `--brass` 4.08 are under 4.5. Darken them, or restrict them to icons and large text? *Phase 1.*
16. Recent items (Diagnose's recent reports, Tables Recently viewed, Continue reading): how many, which key, and do they go in the backup file? The recording rule is set (Phase 6, step 4: on Diagnose, Enter, or leaving the field with a recognised code); confirm it. And what does Main's top-bar ibtn "Recent reports" open (the full history, or nothing until there is one)? *Phase 6.*
17. HandbookReader's per-page pager (1-14 / 1-16): does it replace today's per-section navigation? *Phase 8.*
18. The ComponentPage prev/next pager isn't on the Switch board. Keep it? *Phase 7.*
19. The Care, Setup and Verify bodies aren't drawn. Restyle only, keeping their content and tests? *Phase 9.*
20. DiagnoseSearch scope: do parts (2,562 lines) and manual OCR go in the index, loaded lazily? *Phase 6.*
21. The selected-marker pulse: once (board) or looping (today)? *Phase 1.*
22. Install: a custom sheet on `beforeinstallprompt` (Chromium), with the iPhone text as the fallback? *Phase 11.*
23. Add a 390×844 Playwright project? The tests use `setViewportSize` meanwhile. *None.*
24. Drop the `valvet:theme` and `valvet:status` legacy fallbacks? *None.*
25. Where does the layer-source link go on the new map ("Playfield Shots, PDF pages 9–10" and the others)? It isn't drawn. *Phases 1 and 2 (meanwhile it sits at the top of the aside from 1000 and at the top of the All parts sheet on phones; never under the stage, which would scroll the page).*
26. The expanded-sheet links. MapExpanded shows Details / Manual / Switch matrix / On the shopping list; MapFitSpec's schematic shows other labels. Confirm MapExpanded? *Phase 2.*
27. What does the "Show faults, N" pill do (filter the markers, or open the list)? *Phase 2.*
28. What does the Map's "Find a part" ibtn do? It's on Map, ShellTablet and ShellDesktop, but its result isn't drawn. The proposal: it opens the parts list with a "Find a part" field focused that filters by id or name (the All parts sheet on phones; the panel list from 1000). *Phases 2 and 5.*
