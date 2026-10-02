# App redesign: five tabs, a fitted map, app-like shell

**Status 2026-09-28: complete. Phases 1–12 implemented, each with a green gauntlet, merged to `main` (fast-forward, `d27cd47..02c7447`) and pushed to `origin/main`. Deviations and decisions sit under each phase; the open questions below not marked answered were settled by the plan's defaults (named in the phase notes) and can be reopened as follow-up work.**

- Spec (all values): `.claude/tasks/app-redesign-spec.md`.
- Design canvas: <https://claude.ai/artifact/UafRUTDKLxz4RYNuLmeeuh>.
- This plan supersedes an earlier workshop-mode slice (`.claude/tasks/mobile-redesign.md` plus diffs in `tokens.css` and `base.css`). That slice was never committed: it sits only in the `addams-handbook-mobile-redesign-fc850f` worktree, not on `main` (see Q1).

## How to run a phase

1. One phase per session.
2. Start by reading this file, the spec and `git status`. Read only the files the phase names; don't rescan the repo.
3. Open the boards the phase names with the Artifact tool: action "read", url <https://claude.ai/artifact/UafRUTDKLxz4RYNuLmeeuh>, path "project/<Board>.dc.html". The canvas is private to the owner's claude.ai account. If it can't be read, the spec file is authoritative.
4. If an open question blocks the phase (the tag after each question), ask the owner first.
5. Finish with the gauntlet green:
   - First time in a worktree: it has no `node_modules` (only the main checkout does). Run `pnpm install --frozen-lockfile` (as CI does, `.github/workflows/deploy.yml:27`), then `pnpm exec playwright install chromium` if the browsers are missing.
   - Stop any stray preview on port 4321 first: locally Playwright reuses a running server (`playwright.config.ts:30` `reuseExistingServer`), so a stale preview tests an old build. `shopping-list.md` used `pnpm exec astro preview stop`; if the Astro CLI rejects that, stop the process listening on 4321.
   - Run `pnpm check` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm test:e2e`.
   - Record `grep -ro 'data-find=' dist --include=*.html | wc -l` (the target is Q4). Don't use `grep -c`: the built HTML is compressed onto few lines and Git Bash has no globstar, so `grep -c … dist/**/*.html` under-counts.
   - Base-path check, last (it leaves `dist` built with a base): `MSYS_NO_PATHCONV=1 BASE_PATH=/TheAddamsFamilyHandbook/ pnpm build` (in Git Bash the MSYS prefix is required, or the leading slash becomes a Windows path and every URL shows up unprefixed), then `grep -rhoE '(href|src)="/[^"]*"' dist --include=*.html | grep -v '="/TheAddamsFamilyHandbook/' | sort -u`. Expect no output. CI deploys under `/<repo>/` (`deploy.yml:32`). If the first run (before Phase 1) already lists some, record them here as the baseline and add none.
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
  | --- | --- |
  | Diagnose | Diagnose and the header search |
  | Map | Map |
  | Tables | Switches, Lamps, Solenoids, Fuses |
  | Handbook | Handbook, Manuals, Parts |
  | Workshop | Shopping list, Verify, Setup, Care, the theme control, device data |

- **Home.** Diagnose is home. Quick links (Playfield map, Switch matrix, Lamp matrix) sit at the top, recent reports under them, and the paste field is docked low. From 1000 the field sits at the top of the column instead (2026-09-30, audit P2 item 4).
- **Tab 5.** The shopping list lives in Workshop, and its count rides on the Workshop badge. The variant that makes Shopping list tab 5 is not the default. The Rationale §06 board argues both sides and recommends Workshop; it is the owner's call (Q2).
- **Breakpoints.**

  | Width | Navigation | Map selection |
  | --- | --- | --- |
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
- **Design-system foundations** (2026-09-30, audit P2 item 2: DS-02, DS-06, DS-07, DS-10, DS-11, DS-14, DS-15, DS-20, VP-09, VP-10, VP-14, SV-16). Spec §2, §4 and §8.6–§8.8 carry the detail.
  - **Type.** Every step of the scale is a `--t-*` token and a `.t-*` class. The headings take their steps: h1 34/41, h2 22/28, h3 20/24, h4 17/22 600 (they were 1.9, 1.45 and 1.2 rem). `.hint` moves from 15/21 to `t-sub` 15/20.
  - **Body stays 16.** `--t-body` (17/24) exists, but the body keeps 16/1.5 until the owner answers Q14.
  - **Buttons.** The bare `.btn` is the spec's gray variant (`--sunk`, `--ink`); `.btn.gray` spells it out. `.btn.sm` gets a `::after` reaching 4 above and below, so a small button standing alone still has a 44 hit area. `.btn.mono` puts back the mono face that the `.btn.sm` shorthand would drop. `.btn.active` is dropped (no markup used it): the pressed state is `.btn[aria-pressed='true']`, and `.btn:disabled` fades to .45.
  - **`.btn.small`** stays as an alias of `.btn.sm` for one release. A follow-up drops it once no markup says `small`.
  - **Search at 16px.** `.search` is 16/21, not the boards' 15/20, because iOS Safari zooms into any field under 16px. Its box is 44 tall with the 36 pill painted inside by a 4 px transparent border, so no search field loses the 44 hit area the old `.field` searches had.
  - **Calib exception.** The `?calib=1` tools (the calibration textarea and the overlay select) are the only fields exempt from the 16px rule: they are for the developer and never on a user route.
  - **Clear and empty state.** A search field shows a "Clear search" button only while it has text. The button empties the field and puts focus back in it. A search with no hits shows one line, `No {things} match “{q}”.`, and placeholders lose their ellipsis.
  - **Stacking.** A named `--z-*` scale (spec §4) replaces every bare z-index. The toast stays under modal sheets, because a modal makes the toast inert. It clears the reader toolbar and the map sheet by position instead: the host adds `--toast-lift`, which the islands set on the root (it is not a token).
  - **Wires.** `.wire` (a swatch and a mono name, no background, no cursor) replaces WireChip's `.chip`, because a chip reads as a control.
  - **`--dur-0`** (150 ms) names the reduced-motion cross-fade.
  - **Map list tile.** The id tile becomes `.code.dmd` (spec §7.7), and the selected row keeps its amber tile.
- **Design-system islands** (2026-09-30, audit P2 item 2, the second half). Every island and page is now on the foundations: no bare z-index, radius literal or loose `:hover` is left in src, and the unit test lints all of src.
  - **One search field.** `SearchField.svelte` is the only search field markup: HandbookToc, ManualSearch, PartsList and the map's "Find a part" use it, and tables.astro writes the same markup by hand. Each island keeps its own behaviour (the parts list still strips its hash, Manuals still loads the index on focus).
  - **Clear room only with text.** `.srch .search` reserves the 44 for the clear button only while the field has text (`:not(:placeholder-shown)`), so a long placeholder such as "Search the handbook and scans" is not cut at 320.
  - **Manuals row.** The field keeps at least 136 beside the document select; on a 320 phone the select wraps under it instead of squeezing the field to two letters.
  - **Toast lift.** The reader toolbar sets `--toast-lift: 62px` from `:root:has(nav.rbar)` (the nav, because Diagnose also has a `div.rbar` that is not a toolbar). The phone map sheet sets it to its current detent's height while it is open and removes it when it closes.
  - **Map sheet header.** The selected part's number is `.code.lg.dmd` in the phone peek and the wide panel, as spec §7.6 and §7.7 draw it (40 tall, mono 22).
  - **Reader text view.** PageViewer's OCR text keeps the body face at `--t-sub`: it is prose, and the mono step made it read as code.
  - **Small buttons in a wrapping row** sit 8 apart, so the 4 px hit-area extensions of two rows never overlap.
  - **Swipe spring-back** uses `--dur-3` (300 ms, was 250).
- **Design-system review fixes** (2026-09-30, audit P2 item 2, after the two reviews).
  - **Toast over the Diagnose dock.** Over results and a search the toast now clears the sticky dock: while the dock reaches into the 80 above the tab bar, Diagnose sets `--toast-lift` to the distance from the dock's top to the bar. When the dock sits higher (short results, or scrolled to the end) there is no lift, because a fixed lift of the dock's height would put the toast on the dock. At HEAD the toast covered Paste and Diagnose.
  - **Map lift keeps its safe-bot.** The map sheet's lift stays `detent + safe-bot`: the sheet pads its body with safe-bot and is that much taller, so a lift of the detent alone would sink the toast into the sheet on a phone with a home indicator (checked with a 34 px inset: 10 above the sheet at both detents).
  - **Wire edge in light.** The light `--wire-edge` is .35 (was .18), the strength of the 1 px border the old wire chip had, so a white wire keeps its edge on the light page.
  - **Handbook Contents heading** keeps its display face: `t-head` size with Fell at 400, as the manual card heads (`.mhead`). It was Fell 17.6 at HEAD; the plain `t-head` would have made it Plex Sans 600.
  - **Sheet actions wrap.** The part sheet's "Open in Map" and "Manual page" share the row equally while both fit and stack at full width on a 320 phone, where the two 165-wide buttons overflowed the sheet by 36 (at HEAD too). The row alone did not fix it: the sheet's grid had an implicit auto column, and the map crop, which starts at 340 before it measures itself, held that column at 340; the column is now `minmax(0, 1fr)`, so the crop measures 288 and the map fits too.
- **Light theme and print** (2026-09-30, audit P2 item 3: DS-03, DS-04, DS-05, DS-08, DS-09, AY-04, AY-16). Spec §1.1, §1.2, §8.3, §8.6, §9.15 and §12 carry the values. `tests/e2e/contrast.spec.ts` measures every visible text node, placeholder and state ring on 15 route states in both themes, and print on six routes in both themes (eight, and the two matrices on A4, after the review fixes below).
  - **`--amber` is never a text colour** (R1). Of the twelve `color: var(--amber)` sites in src, ten take `--amber-ink` (HandbookToc ×2, ManualSearch, Matrix ×2, ReaderBar, SetupGuide, the manual page's contents row, the Workshop's pull line, `.mhead b`), `.dmd` takes `--dmd-ink`, and the shopping list's `.id` loses its scoped colour, which was beating `.dmd`. The unit lint allows none (property `color` exactly, so the `.field:focus` border, a boundary at 3.30, stays `--amber`). The map's switch layer keeps `--k: var(--amber)` for its marker ring, legend dot and icon, which must match the other rings, and gets `--k-ink: var(--amber-ink)` for its heading and list heads. The selected marker's label sits on an opaque `--surface` chip, so it reads whatever the photo does.
  - **One DMD recipe** (R2). `.dmd` and Diagnose's `.well` both read `--dmd-ink`, `--dmd-dot` and `--dmd-well` (the dot alpha is the token's .13, was a .14 literal). `.dmd`'s glow is `0 0 6px rgba(255,138,61,.45)` in both themes: the old dark `--amber-glow`, so dark does not change, and light now has the glow on its dark well. The well keeps its 10 px glow; its placeholder goes from .45 to .7 opacity (26 px text, 3:1).
  - **Light inks one step darker** (R3), in both light blocks: `--amber-ink` and `--amber-fill` #9e4009 (was #a8440a), `--ok` #256738 (#2a7340), `--warn` #7a5505 (#875e06), `--bad` #ab2e27 (#b8322a), `--brass` #70552b (#7d6033), `--faint` #645c6c (#6e6676). Dark: `--brass` #b8955f (#b08d57) and `--faint` #918997 (#857d8d); nothing else in dark changes. The rule of 2026-09-25 is extended: an ink passes 4.5 on its own tint over `--ground`, the worst real surface. The tints and `--amber` (#c9520f, the rings) keep their values.
  - **Placeholders** (R4). `.field::placeholder` is `--faint` at full opacity, as `.search` already was; the UA grey was 3.4 on `--sunk`.
  - **Segment edge** (R5, AY-16). The chosen segment's `0 0 0 .5px` black hairline becomes `0 0 0 1px var(--seg-edge)`, a new token (dark `rgba(236,230,218,.4)`, light `rgba(28,23,32,.5)`), 3.26 and 3.12 against the track. The OK and Fault variants keep their own rings.
  - **Unused matrix cells** (R6) are grey, not dimmed: `td.unused a` is `--muted` and `td.unused .id` `--faint`. The colour goes on the link, because `td a` sets its own; opacity .45 took the text under 4.5.
  - **Swipe pane** (R7, DS-09) is `--ok` with `--on-amber` text, because Fixed is a good outcome; the only red action, "Clear all", stays `--bad`. The label sits at the pane's far edge, uncovered at about 60 px of drag, before the armed point. `--on-amber` is the text colour on any saturated fill (amber, ok), not only amber.
  - **Print** (R8, DS-03). Every print token lives in one block at the end of tokens.css whose selector list matches the light blocks' specificity (0,2,0) and comes after them, so it wins in all six scheme × theme cases with no `!important`. It is black on white and gives the other inks their light values, so a dark-theme print is readable; scans print uninverted and DMD codes lose their glow. base.css's print block keeps only layout: it hides the controls and chrome, and prints the title once. On a page that renders its own h1 the bar is hidden; on large-title and bar pages the bar stays as a plain full-width title that wraps (the full title, never the phone's short word). A bare `header.top` hide would have lost the title on tab roots, where from 600 px the large title is visually hidden and the bar carries it.
  - **The sweep measures text, not tokens** (R9): every visible text node and placeholder, composited over its backdrop with the opacity chain, so a colour that reaches text through a custom property or an opacity is caught. In light it also fails any text whose colour equals `--amber`.
  - **Review fixes** (after the two reviews). These supersede R3's dark `--faint`, R4, R6's id colour and R8's large-title print above.
    - **Dark `--faint` stays #857d8d; faint text takes `--faint-ink`.** The #918997 lift changed the tab labels, row chevrons and off-layer icons, which already passed. A new text twin `--faint-ink` (dark #918997, light and print #645c6c) goes only on the three failing sites: `.field::placeholder`, `.search::placeholder` and `td.unused .id`. The unit test pins dark `--faint`, checks `--faint-ink` at 4.5 on six surfaces in both themes, and checks those three sites.
    - **Map list Fault pill.** In the selected row the pill's `--bad-tint` stacked on the row's amber tint and took the dark `--bad` to 4.25. `.rows .row.sel .pill.fault` now paints the tint over an opaque `--cell` (`linear-gradient(var(--bad-tint), var(--bad-tint)), var(--cell)`): 5.45 dark, 5.58 light; other rows are unchanged. The sweep's backdrop now composites a flat `linear-gradient(x, x)` image layer over the background colour, since it read the colour alone before. The map route marks switch 32 Fault first, so the pill is measured.
    - **Light glass bar .94** (was .84). A DMD code scrolled under the bar took the back link's `--amber-ink` to 3.9. At .94 the bar's inks (`--amber-ink`, `--faint`, `--muted`, `--ink`) pass 4.5 over `--dmd-well` and over `--ground`, in both light blocks (unit test).
    - **Large-title print.** The print block hid `.lt` and kept the bar, so a large-title page printed the bar's aria-hidden `div.ct`, not its h1. Now `header.top[data-h1='large']` is hidden like the page-h1 bar, and `.lt` is unclipped with its h1 at full opacity and `t-title`. Only bar pages keep the header. The print test checks that the one printed title is an h1 outside `aria-hidden`.
    - **Matrices on A4.** /switches and /lamps were clipped on paper (`min-width` and nowrap wire labels). Matrix.svelte's print block fits the table to 718 px (A4 less Chrome's default 1 cm margins): fixed layout at 100 %, 88 px row heads, 3×4 cell padding, names at 10 px, and wire labels and pins at 9 px that wrap. A print test at 718 px checks that no cell and no scroller overflows.
    - **`.dmd` print rule only.** `.well` came out of the `.dmd, .well` print rule: the well is in the dock, which print hides. Spec §8.6 now says so; the unit test fails any base.css print rule that names `.well`.
    - **Print test coverage.** The print HIDDEN list adds `.acts`, `.back`, `nav.pn`, `.hb .side`, `.ptr`, `.scrim`, `.sheet.map` and `.sheet.dialog`; each route names the chrome it shows on screen, so its print check is not vacuous. /?q=32 replaces / (the dock with results), and /workshop with the install sheet open and /map with a part selected join.
    - **Tests read tokens, not literals.** map.spec.ts's link test reads `--amber-ink` from the page in each theme. The unit lint (g) matches `var(--amber)` in any spelling (spaces, a fallback, `!important`) and also fails a custom property that carries `--amber` outside an allow-list (the map's `.k-sw --k`, its ring colour).
    - **Not changed: `.field` borders in dark** (1.39 on the ground; 1.47 in light). Pre-existing and the same at HEAD, the same design as the fill-only `.search`, and §12 asks 3:1 only of state rings and the segment edge. A candidate for P2 item 5 (accessibility).
  - **Second review fixes** (after a fresh review of the first round). These supersede R3's dark `--brass` and the selected-row-only Fault pill above.
    - **Dark `--brass` stays #b08d57; brass text takes `--brass-ink`.** The #b8955f lift changed the rules and borders (ManualSearch, SetupGuide, ComponentPage.astro, the handbook section, base.css) and the map's coil ring, which already passed. As with `--faint-ink`, a text twin `--brass-ink` (dark #b8955f, light and print #70552b) goes only on the two brass text sites: base.css `.hint strong` (4.43 at #b08d57 on `--brass-tint` over a card's `--cell`, 4.89 now; 5.54 on /switch/32) and SetupGuide's step number `.n` (6.38 dark, 6.78 light). Both light blocks and the print block carry it. Unit test (k) pins dark `--brass`, checks `--brass-ink` at 4.5 on `--ground`, `--surface`, `--cell` and `--raised` and on `--brass-tint` over the first three in both themes, checks the two sites, and fails any rule whose text colour is `--brass`. The print test checks `--brass-ink` on white.
    - **Every map-list pill on an opaque base.** A hovered row's `--sunk` took the light Fault pill to 4.28 (an OK or Not tested pill would be 4.39 and 4.40). Each status now sets the pill's tint as `--pill-tint`, and `.rows .row .pill` paints `linear-gradient(var(--pill-tint), var(--pill-tint)), var(--cell)` in every row: 5.58 light and 5.45 dark on any row background. Named `.rows .row .pill.ok` and `.pill.untested` rules were not used: the list renders only the Fault pill, so Svelte flags them as unused selectors and drops them. The sweep's map route marks switch 33 Fault as well and, on desktop, rests the pointer on its row (checking that the row paints `--sunk`), so the hovered pill is measured; it failed at 4.28 before the fix.
    - **Action rows and the page number do not print.** base.css's print block hides `button.lrow` (Show on map, Download backup, Clear all, Install the handbook, About this handbook, the recent-report rows) and the manual reader's `.pgno` "25 / 124", a button that opens the Go to page sheet; the bar's h1 already names the page. `a.lrow` content links still print. The print HIDDEN list adds both; /shopping and /switch/32 name `button.lrow` and /manual/ops/25 `.pgno` as shown on screen, and those print tests (six per project) failed before the fix.
  - **Where the build differs from the reviewed design:**
    - DS-04 needed no change: P2 item 2 already made `.btn.primary` `--amber-fill` with `--on-amber` (6.25 light). The sweep pins it at 4.5 on every route.
    - Print hides `nav.rbar` and `.tlink`, not every `.rbar`: Diagnose's `div.rbar` carries the results heading ("N codes"), which is content, and its buttons are `.tlink`.
    - No `.toggle` hide: no element has that class.
    - The optional `.hb .side` hide is in, so a handbook section does not print its contents card before the article.
    - The sweep does not skip `aria-hidden` text: on page-h1 routes the bar title is an aria-hidden `div.ct` and is visible text. It skips `[inert]`, `.sr-only`, `.ptr` (a gesture hint), `.pane` (its own test) and the unselected marker labels (photo backdrop).
    - The DMD check leaves out the map list's selected tile, which is amber on purpose (spec §7.7).
    - The unit check for the old dot literal reads property declarations only: the dark `--tint` token has the same value.
    - Two new checks pass before the change as well, as guards: the unit test that the two light blocks stay identical, and the sweep of the open install sheet, where nothing failed.
- **Tables, matrices and large screens** (2026-09-30, audit P2 item 4: VP-04, VP-12, VL-06, VL-07, VL-01, VL-04, VL-05, VL-08, VL-09, VL-10, VP-05, VP-06, VP-07, UX-15, VP-08). Spec §1.3, §3.1 (new), §6.6, §7.4, §7.7, §8.6, §8.9 (new), §9.1, §9.2, §9.6, §9.12, §9.13 and §9.14 carry the values. `tests/e2e/layout-overflow.spec.ts` gains the P2-4 sweeps (320–1440), and the unit lint gains checks (m) to (p).
  - **One content column** (VL-10, VP-08). `.wrap` is `--content-w` (1120) on every tab but the map. `main.wide` and the `wide` prop are gone: they never bound under 1712, and the tables at 1440 narrow from 1152 to 1088. A hub is a start-aligned `--hub-w` (640) column that cancels the wrap gutter, so its lists and search pill sit on the page's content edge at every width (16–396 at 412; main's content-left from 1000) and are no longer centred.
  - **Measure on text blocks, never the column** (VL-09). `--measure` is 52ch (65ch before the review), on the handbook prose blocks, the component notes, ComponentDetail's hint, the SetupGuide intro, warning, why and step text and item names, a page's own and a tab panel's paragraphs, every group footer and the provenance notes, and the Diagnose intro. A measure on `.prose` shrank the handbook's embedded map until its glass covered the drawing, so figures, tables and the embed keep the column. `ch` is kept for the measure; other widths are px (unit check n).
  - **Tables** (VP-04, VL-07, VP-05). Codes never break (`nowrap` on mono cells), every column has a header, and the Broken tick is a 44 × 44 label that fills its cell. From 600 a table wider than its wrapper pins the id and the tick. Under 600 the J205, J806, lamp, solenoid, flipper, GI and parts tables are two-line rows (id, name, tick; then header-prefixed pairs) with explicit ARIA roles, so no table scrolls sideways at 320. The flipper and GI tables stack at every width.
  - **Matrices** (VP-12, VL-06). They fit the column from 1000 (fixed layout, wrapping names and header wire labels), scroll under a pinned row-header column at 600–999, and fit the phone with id-only cells of at least 24 × 44. A keyboard selection brings the card into view above the tab bar, then the cell if both do not fit.
  - **Map from 1000** (VL-01, VL-04). The side panel is one scroll column of the stage height (no nested scrollers, no clipped card, no dead band), and every selection scrolls it to the top. The glass floats only where the drawing's measured side gutter holds it (184); otherwise the layers are four 44 toggles in the panel, the readout moves above the capsule and the legend is a panel hint. The embed is unchanged.
  - **Manual viewer** (VL-05). Fit width and Fit page, fit page by default from 1000, the choice kept in `localStorage` across page turns. At a fit the page scrolls and the stage does not; zoomed, the stage is the one scroller. The capsule rides the viewport's foot.
  - **Diagnose from 1000** (VL-08). The field is at the top of the column in every mode, in flow and at most 720 wide; the toast is not lifted there. The field comes first in the DOM at every width; under 1000 the look is unchanged.
  - **Appearance row and code badge** (VP-07, UX-15, VP-06). When its row is under 413 (a viewport under 445) the Appearance control wraps onto its own line at the text column. `.code` never wraps and header badges are `flex: none`, so `SOL 01` is one line at 320.
  - **Where the build differs from the reviewed design:**
    - The glass floats from a gutter of 184 (16 + 164 + 4), not 188: 1440 × 900 measures 187.5, and 188 would have put the glass in the panel at the one size the boards draw floating.
    - The panel is on the page ground (`--panel-bg: var(--ground)`), not `--surface`; its sticky header and foot fade paint the same token. In the panel the `.lh` header trades 6 of its 16 top margin and its 4 bottom margin for padding, so its sticky ground covers the rows that scroll under it.
    - The legend floats only when the stage is at least 350 tall (list, legend and gaps), the vertical-clearance rule as a number.
    - The Broken tick fills its cell (`td.chk` has no padding; the label is 44 × 44) instead of a label with −13 margins: the margins made the phone rows' tick overflow the wrapper.
    - `.scroll-x` is `position: relative`, so the sr-only Location header stays inside the table's scroller instead of widening the page at 600.
    - A code phrase such as `F111 Flasher Secondary (5A S.B.)` is a `td.phrase` of nowrap `.tok` tokens, so it wraps at its spaces at every width and its tokens stay whole. Empty cells are hidden on the phone.
    - The flipper and GI pair is a `.pair` grid with `minmax(0, 1fr)`; `.grid-2` stays in base.css, unused.
    - The matrix card reveal runs on `:focus-visible` only, so a pointer press does not move the page between press and click; cells keep `height: 58px` from 1000 (a table cell's height is its minimum). The 600–999 matrix block is `screen` only, and cells get a 124 left scroll margin.
    - The manual capsule row uses `margin: -12px 0 12px` so the zero-height row takes no space; the fit buttons are icons with `aria-label` and `title`, the pressed fit is `--amber-ink`, W and P are ignored with Ctrl, Cmd or Alt, and zooming out of a fit keeps the visible middle of the stage as its anchor.
    - At a fit the stage clips (`overflow: clip`) rather than leaving overflow visible: until the island measures the scan, the server-rendered half-size scan would widen a phone page, and Chromium then skips the cross-document view transition ("Viewport size changed"). The stored fit is read in `onMount`, since storage and `matchMedia` exist only in the browser.
    - Diagnose's desktop dock has `margin-bottom: var(--gap)`, no padding and no glass background, and the toast guard uses Svelte's `MediaQuery` rather than a bare `matchMedia`.
    - The Workshop wrap rule is scoped in WorkshopHub.svelte; the map card's id column is `min-width: 27px` (was 3ch) so `ch` stays the measure's unit.
    - The measure also covers ComponentDetail's `.gf`, and the hub test compares with main's content-left (there is no `.hub > h1`; the title is in the bar from 600).
  - **Guards.** Some new checks pass before the change as well: the page-scroll sweep (page overflow was already 0), the row-role count, the embed glass at 1280 and 1440, the Diagnose phone dock at 412 and the manual viewer at 412.
  - **Review fixes** (2026-09-30, two adversarial reviews of the change). Each new check was run against a build with its fix taken out and failed there, unless noted.
    - Measure: 52ch, because `1ch` is a "0" and wider than the average letter. 65ch set 84–94 characters a line; 52ch sets 60–80. The e2e now counts characters a line at 1000, 1280 and 1440 on the handbook, the component notes, /care, /setup and /coils, instead of comparing widths with 65ch. `.wrap > p`, `.prov` and SetupGuide's `.step > p` take the measure, so the step intros, the provenance notes and the paragraphs under /care and /setup are measured too.
    - Manual fit page: the scan fits from the stage's own document top to 16 above the foot, so it is whole as the page opens (the stage ran to 960 at 1440 × 900 and 780 at 1280 × 720). The zoomed slice keeps the old height. The e2e checks the stage's foot at 412 × 839, 1000 × 900, 1280 × 720, 1366 × 768 and 1440 × 900 with fit page on.
    - Code phrases: `Phrase.astro` splits a cell's text into nowrap `.tok` spans (a bracketed group is one) in a `td.phrase` (`white-space: normal`). The solenoid tables no longer scroll at 1000 and 1280 (942/856, 997/856 and 997/960 before), and the LED table fits 320 (261/256 before, "CPU D19" kept whole). The phone pair cells no longer set `white-space: normal` themselves.
    - Phone tables: rows align to the top, and beside the tick the id and name take 12 top padding, so the id and tick sit on the name's first line. The note drops its " · " on the phone (a `.sep` span). The pair labels are in the body face, and the Location reads "in cabinet" or "under playfield". `content` has a plain declaration before the alt-text one (unit check q).
    - Phone matrix: the headers keep the wire's colour swatch (its name and the pin are sr-only) and the corner keeps "row ↓" over "col →" on its whole 40.
    - Diagnose from 1000: Enter scrolls the results heading only as far as it needs (`block: 'nearest'`), so the field stays in view; under 1000 it is still `start`.
    - Map: on /map from 1000 the fit is the larger of the fit beside the 44-wide control column (64 a side) and the fit above the readout and capsule (188), never more than the whole fit, so the capsule and readout clear the drawing at 1000 × 1080 and 1024 × 1366. The readout under a 184 gutter is 44 wide. The panel check now asks that the card is whole and reachable by the panel's scroller, not that it fits at scrollTop 0, which fails at 1366 × 768 and 1280 × 720 with the build as it is; 1366 × 768, 1000 × 1080, 1000 × 1200 and 1024 × 1366 were added, and `.corner` joined the glass list.
    - Appearance: a container query on the "This device" list (row under 413) replaces the 419 media query, and the label keeps `min-width: max-content`, so 420–444 (430 is an iPhone Pro Max) no longer break the label mid-word. The global `.lrow.static { flex-wrap: wrap }` is gone (unit check r); only the Appearance row wraps.
    - The token check's regex was `/S+/g` (runs of the letter S), so it checked nothing. It is `/\S+/g` now. Taking out the mono `nowrap` alone does not fail it, because no code cell at 320–412 is squeezed below its longest token; forcing `word-break: break-all` on the mono cells fails it at /fuses with the fixed regex and passes with the old one.
    - Not changed, by decision: the Fuses tables stay plain `table.t`, not `t two`. Their three short columns fit 320 as a table and they have no Broken tick (S8). The map panel stays on `--ground` (through `--panel-bg`), as §6.6 and the line above record: before the change the panel had no background of its own and showed the ground, so `--surface` would have changed its look (D9).
    - Not reproduced: empty pair cells were said to escape `td:empty` because Astro keeps the whitespace round an expression. The build renders them as `<td …></td>`, so `td:empty` matches; the new e2e check that no empty pair shows guards it, and no `.blank` class was added.
  - **Recheck fixes** (2026-10-01, the two issues the recheck after the review fixes left). Each check failed on a build with its fix taken out.
    - Matrix pins (major): from 1000 the fixed 112 row-header column (104 inside) broke "U18-11" and "U19-11" after the hyphen in "J208-1 · U18-11" and "J208-5 · U19-11", on A4 as well. Each code of a header pin is now a nowrap `.tok` (the class Phrase.astro uses), so the pin wraps at " · " (the column header's at its `<br>`). The P2-4 matrices e2e at 1000, 1280 and 1440 and the A4 print test now fail any pin word on two lines; both matrices pass, the lamp matrix also before the fix.
    - Measure (VL-09): the matrix note on /switches, the bench note on /shopping and Setup's longest item name set 115–142, 148–176 and 113–141 characters a line from 1000. `.panel > p` and `.gf` join `.wrap > p, .prov` in base.css (ComponentDetail's own `.gf` measure is dropped as a duplicate), and SetupGuide's `.name` takes the measure, not `.body`, so the suggested value and the Set field keep the row. They now set 63–65, 64–67 and 62–73. The measure e2e covers the three blocks, counts a block's last line toward the 80 (a one-line block ran long unseen), and checks that the matrix keeps the panel's width and each Setup row's values keep the row's.
- **Accessibility** (2026-10-01, audit P2 item 5: AY-01, AY-02, AY-05, AY-06, AY-07, AY-09, AY-10, AY-11, AY-12, AY-14, AY-15, FIELD-3-1). Spec §1.1, §6.4, §7.5, §7.6, §7.7, §8.7, §9.6, §9.11, §9.12 and §12 carry the rules. The new `tests/e2e/a11y.spec.ts` checks them in both projects, and the unit lint gains checks (s) to (v). Each new check failed on a build of the sources before the change, except the guards below.
  - **Map keyboard** (AY-01). The drawing is the map's one tab stop and the arrows walk the markers (each `tabindex=-1`, a reading-order cursor), instead of 148 marker stops. Calibration keeps every marker a stop, because its arrows nudge the focused marker. A keyboard selection moves focus to the phone sheet or the wide card, now named "Selected part, Switch 32"; Esc or Deselect brings it back to the marker. The embed keeps focus on the marker.
  - **Focus under the bars** (AY-02). `html`'s `scroll-padding-bottom` adds the tab bar and `--toast-lift` (the Diagnose dock, the reader bar). The matrix cell's own bottom scroll margin goes, since the two added up.
  - **Skip link** (AY-05). With focus it is a 44-tall amber pill centred in the top bar, right of the rail or sidebar.
  - **Underlines** (AY-06). Classless links, the small refs, and links in prose and owner's notes are underlined. Buttons and segmented links are not.
  - **Matrix status** (AY-07). A cell's status is in its name ("13 Start Button, Fault") and in a corner mark, not only in the border colour.
  - **Announcements** (AY-09). Each search surface has one sr-only polite region, written 400 ms after the last change and silent on load and for a pre-filled `?q=`. `role=status` stays where it was; PartsList's count joins the spec's list.
  - **Setup names** (AY-10). The code and name make every field, suggestion, handbook link and tick unique, and "Set to" stays in the field's name.
  - **Manual viewer keys** (AY-11). One guard (typing, Ctrl, Cmd, Alt) runs before any key, the titles name the keys, the zoomed stage is a named tab stop that the arrows scroll, and the ends are disabled links. `isTypingTarget` (src/lib/keys.ts) is shared with the map and the matrix page.
  - **44 targets** (AY-12). A `::after` adds hit area where there is room, contiguous rows get real height, and a label counts as its control's target. The allow-list is in §12.
  - **Headings and the note** (AY-14). Handbook sections go h1 → h2 → h3, and the owner's note is a named `role=note`.
  - **Fields** (AY-15, FIELD-3-1). The new `--field-line` draws the `.field` border and the `.search` ring at 3:1 or more, and a focused field keeps the global ring.
  - **Where the build differs from the reviewed design:**
    - The matrix name is an `aria-label` on the cell link, not an sr-only span: the span is out of flow, and Chrome read "13 Start Button , Fault".
    - DiagnoseSearch's chips scroll themselves into view on focus. The tab walk on /?q=flipper found the "Parts" chip half off-screen, because Chrome does not scroll a sideways-scrolling row to a focused child.
    - The handbook contents `summary` is a 44 line (`min-height` and `line-height`), not `display: flex`, which would drop its disclosure marker. ShoppingList's `a.lnk` gets `min-height: 44px` with 9 px vertical padding. DeviceData's file input takes its 44 from its `.file` label. Setup's `.set` stays flex with `min-height: 44px`.
    - `.skip:focus` adds `text-decoration: none`, or the new underline rule would underline the pill. Print's `a` reset shares a rule with the underline selector.
    - Diagnose's announcer gets the search count from DiagnoseSearch through an `oncount` callback. The map's announcer says "1 part matches" for one match (the design gave only the plural).
    - switches.astro's matrix key handler also takes the Ctrl, Cmd and Alt guard.
    - In the tests:
      - The 44 sweep counts a label holding the control as its target, and allows a handbook table's page refs in their cell (`.prose td > a[href]`; "1-2, 3" is two links in one cell, so the first draft's `:only-child` was too narrow; since the recheck, only at 24 wide and 24 from any other target's centre). The design's /device page does not exist; DeviceData is swept on /care.
      - The focus check tests the first line of a wrapped link.
      - OK is set on switch 15, because 12 is unused.
      - /parts keeps its old `role=status`, so it is exempt from "silent on load". Its empty search reads "No parts match “q”." (the review fixes below; it read "0 rows").
      - The owner's-note check runs where a note is present: /handbook/rules has none.
      - The underline check needs an inline link on every page but /handbook/rules, which has none.
      - Two existing checks asserted the old values. setup.spec ticks "Done: A.1 26 Tournament Play": the design expected Tournament Play to have no code. shell.spec measures the sidebar sub-row at 44 (§6.4).
  - **Guards.** Some new checks pass before the change as well:
    - the matrix arrow walk on /switches (the cell's scroll margin did then what the page padding does now);
    - the `role=status` counts on /care, /setup, /shopping and /workshop;
    - the /parts announcement;
    - the underline check on /handbook/rules;
    - on the phone, the 44 sweep on /, /care, /handbook/quick, /map and /tables. Desktop failed on each of these pages.
  - **Review fixes** (2026-10-01, the dynamic and static review of P2 item 5). Each new or changed check below failed in both projects on a build with every fix taken out, and passes with them.
    - 44 sweep (major, AY-12). It measures 26 pages, up from 13 (§12 lists them). "Inline" now means running text: a link in a `p`, `li`, `td`, `dd`, `.why`, `.owner-note` or `.ctext` with at least three words of its own text around it, not in a `nav`, a heading or a `.links` list; `a.small` is no longer allowed. A control also passes when a 44 box flush with one of its edges, not only a centred one, hits only it or its label. Before the fixes 12 pages failed (/?q=12%2013, /care, /coil/01, /coils, /handbook/menus, /handbook/rules, /lamp/11, /lamps, /manual, /setup, /switch/12, /verify).
      - Real 44 height for lists and rows: the menu cards' entries, a component page's appendix links, /verify's links (also 44 wide), the manual index's section headings, the map's list rows (36 before) and source link, and Setup's "handbook" link. `.tlink` is 44 wide as well as tall.
      - A centred `::after` for ComponentCard's title link and the callout's `dd` links. A table's key-column link gets a 44 box anchored at its left edge: a centred one was clipped by the `.scroll-x` scroller, 0–10 px to its left.
    - Skip link. Its ring is inside the pill in `--on-amber` (outline offset −4). On the phone the pill starts at the viewport's top edge, so the outside ring was clipped (4 px over), and on desktop the amber ring on the amber fill was 1.47:1. The check now asserts the ring sits inside the viewport and meets 3:1 on the fill.
    - /parts empty search reads "No parts match “q”." on the `role=status` line, not "0 rows"; the separate "No parts match" paragraph goes, so it is not said twice.
    - Manuals say "1 page", not "1 pages" (both the visible line and the announcement). The announcement check accepts `/^\d+ pages?$/`, and a new check searches "intelligence", which matches one page.
    - Diagnose: a chip pressed after a pre-filled `?q=` is announced. `liveText` gains `arm()`, which DiagnoseSearch calls through a new `onfilter` prop before it changes the group.
    - Manual viewer: the fit button in force names `0` in its title ("Fit width (W, 0)"), and the legend reads "0 back to the fit". On a zoomed stage the arrows scroll the stage by 40 in the handler and cancel the key, so they stop at its edges: on the phone, with about 33 px to scroll, ArrowDown went on to scroll the window.
    - Map: a clicked or tapped Deselect returns focus to the marker with `preventScroll`, so the drawing stays where it was panned. Esc and a keyboard Deselect (click `detail` 0) still scroll the marker into view.
    - Not changed, by decision: the focused skip pill covers the phone bar's back link and title. It shows only while it has focus, and only the focused element must stay unhidden (WCAG 2.4.11); the 44 bar has no free 44 space beside them. The review also let a handbook table's page refs ("1-2, 3") stay allowed as dense table data, "about 24 × 33"; that was the cell, and the recheck fixes below size the links instead.
  - **Recheck fixes** (2026-10-01, the recheck after the review fixes). The first two checks failed in both projects with their fix taken out, and pass with it.
    - Handbook page refs (major, AY-12). On /handbook/quick the 106 refs measured 9-33 × 19 in 33-tall rows, and on the phone 16 failed WCAG 2.5.8 ("1-2" and "3" have centres 21 apart). A page ref in a `.prose` cell (a link to a `#pg-` anchor or a /manual/ page) is now an inline-block at least 24 wide with 3 px over and under its 20 px line, taken back by the margin: 24-33 × 26 in the same 33 rows, with no wrap in its cell, since a second line 20 below put two refs 20 apart. 6 px filled the row but pushed the focus ring's bottom edge out of the table's scroller on a last row; 7 overlapped the next row. Print sets them inline again. The 44 sweep allows a `.prose td > a[href]` only when it is at least 24 wide and no other target in its table is centred nearer than 24; "see A6 Flippers" on /handbook/appendix (77 × 19 on desktop) passes that way. No other handbook section has a link in a table cell.
    - Manual search (minor, AY-09). The Document select calls `arm()` on `change`, so on /manual?q=flipper choosing the Operator's Handbook announces "3 pages". The handbook contents, the map's list and /tables have no pre-filled query, and /parts announces on its `role=status` line, so none of them has the gap.
    - design-system.spec's "Go" check waits for the sheet's rise to finish and rounds the height, which read 49.99994 mid-rise about once in ten runs.
- **One name per thing** (2026-10-01, audit P3 item 1: CP-01 to CP-20, UX-06, UX-07, UX-10, CR-09). The new spec §13 holds the glossary and six rules (state words, codes, p. and PDF page, inline-link spacing, page names, Source links); §6.4, §6.5, §6.6, §7.5, §7.6, §7.7, §8.2, §8.6, §8.7, §8.8, §8.9, §9.2, §9.6–§9.16, §11 and §12 take the new labels. Words only: stored values, the backup format (version 2), the storage keys, routes, ids, anchors and `src/content/**` are unchanged. `tests/unit/copy.test.ts` reads the source against rules (a) to (l), and the README against three more checks; `copy-helpers.test.ts` and status-io's dates block test the helpers; new e2e checks sit in tables, shopping, diagnose, storage, shell, a11y and layout-overflow. Each new check failed on a build of the sources before the change (31 e2e runs in the two projects, 15 unit tests, and copy-helpers, which cannot load without `src/lib/copy.ts`) and passes with it.
  - **Kept, by decision:**
    - The backup file name stays an ISO date, `tafh-status-YYYY-MM-DD.json`, now from the local date (`localIsoDate`): it sorts by name and is a file name, not prose.
    - Map markers and the 32 px map list tiles show the bare id. So do the per-kind tables' "#" columns and the matrix grid cells: the column is headed "#", and a prefix would widen the tables at 1000 and up.
    - The calibration overlay (`?calib=1`) is developer-only and keeps its `src/data/positions.json` reference (allow-listed in copy.test.ts).
    - "TAF Handbook" stays the home-screen label (manifest `short_name`, `apple-mobile-web-app-title`): the full name truncates under an icon. Everywhere else the app is "The Addams Family Handbook" or "the app".
    - `DOC_NAME` is unchanged: it holds the documents' own titles. So are the Operator's Handbook's page titles in the manual contents ("Solenoid table" is its page 6) and the appendix notes in `src/content` ("Setup step 3" in A2).
    - Undo for the shopping list's "Fixed" is out of scope; the button and the swipe still clear the status at once.
  - **Where the build differs from the reviewed design:**
    - The helpers live in `src/lib/copy.ts`, not components.ts, with `KIND_LABEL` moved there and re-exported: an island can import them without pulling components.json into its bundle. `locationLine(kind, item, opts?)` takes the kind and a structural `Located` type, so a matrix cell works too. The card and the detail page show the bulb on its own row; a Related row passes `{ bulb: true }`, so a lamp reads "Lamp · bulb #555" in place of its matrix place and the row stays one line on a phone. A flipper or dedicated switch names the connector from its pin: the buttons read "flipper (J805)", the EOS switches "flipper (J806)".
    - Location parts are lower case after the kind ("Switch · matrix column 3, row 2"); `capitalise` starts a line that stands alone. The map list subtitle uses it only where a subtitle existed (solenoids, matrix cells), and leaves out "not used", which the row's name and "not on map" already say.
    - The manual contents' value column reads the printed label or "PDF page n".
    - TabBadge, the shopping list total and Device data keep the number where it is drawn (the pill, the DMD digits, the mono span) and agree the noun with `agree(n, one, many?)`, since `plural()` would print the number twice. The words are the same: "1 part to order".
    - DiagnoseSearch keeps the driver, "Fliptronics" and "owner service notes" as hidden keywords in the haystack, so old searches still hit. Diagnose's example rows keep "SOL 7", because they show what the parser accepts; its provenance line reads "SOL 01–28".
    - The map's provenance text says "p. 2-39 to 2-41" and the shot notes "p. E–F", because PDF pages 9 and 10 print the labels E and F.
    - PageViewer's image alt is `${DOC_NAME} ${pageTitleText}` and the zoomed stage's name uses `pageRefText`. The manual page's `short` is `pageTitleText`.
    - 404 says "That page is not in the app."; the update toasts say "A new version of the app is ready." and "The app is up to date."
    - The handbook appendix's title is "Handbook appendix", so its description is "The handbook appendix: notes written for this machine, each naming its sources." instead of the design's template, which would repeat the title.
    - Verify's "Transcription" link becomes "Test menu", and its links use `pageRefText`. Its "Setup step 3/5/6" links become "Machine setup step 3/5/6" with step 7; the design listed only step 7.
    - WireChip keeps a tooltip only when the kit's abbreviation differs from the full name, Gray and Grey counted as the same.
    - The manual page keeps "Read the transcription" (handbook.spec reads it).
    - Fuses reads "the manual page is <link>"; Setup's links are reordered so a sentence has one "and"; the site footer reads "Manual text and pages are ©" rather than "manual pages", which would say "manual" twice; HandbookToc's field is "Search the handbook" in both modes; /tables keeps its hidden static "No tables match." line, which the script fills with the query.
    - appendix.ts writes "the J137/J133 connector" without spaces, and the handbook loader's build log uses `plural`: rules (b) and (e) read every source file.
    - WorkshopHub loses the `careNext` prop, since the Care row's sub line is now fixed ("Every week to every year").
    - copy.test.ts rule (f) also reads the contents' `[page, 'title']` tuples, and rule (h) is narrowed to a whole `` `#${x}` `` or `'#' + page`, so CSS selectors and anchors are not read as copy.
    - A component card now has two links named "Show on map", the mini-map and the action button, both to the same map URL; diagnose.spec counts two and checks each href.
    - In the tests: the design put the state-word checks in switches.spec, which does not exist, so they and the verbs check are in tables.spec. The /switches Fault check names "Left Flipper Button", because switch 32 is a matrix cell with no tick.
    - Rule (d)'s line-break form ("word", line break, `<a`) applies to `.astro` files only. Astro drops that line break, so the words run together; Svelte 5 keeps it as one space, and eslint's `svelte/no-useless-mustaches` rejects `{' '}` in a `.svelte` file. A `.svelte` file still fails on a word written right against `<a`. So PlayfieldMap's shot notes ("on the manual's shot map,", line break, link) carry no `{' '}`.
    - TabBadge's hidden text is one template literal, `` {` ${agree(count, 'part')} to order`} ``: Svelte trims the space at the start of an element, so HEAD's `<span class="sr-only"> parts to order</span>` compiled with no space after the count.
  - **Review fixes** (two adversarial reviews of the change, same day). Each fix has a check that failed on a build of the tree before it: 8 e2e tests in both projects (16 runs) and 10 unit tests.
    - Flipper switches name their own connector: "flipper (J805)" for the buttons F2/F4/F6/F8, "flipper (J806)" for the EOS switches. The first cut said J806 for all eight. `/switches` heads the table "Flipper switches (Fliptronics J805/J806)" and the README says the same. copy-helpers checks every flipper and dedicated switch in components.json against its pin.
    - Related rows on a component page name a lamp's bulb again ("Lamp · bulb #555"), in place of the matrix place: the full line wraps to two lines on a Pixel 7.
    - The map list subtitle no longer repeats "not used" ("11 Not Used · Matrix column 1, row 1 · not on map").
    - The handbook page bar says the page once: the marker "p. 1-15" (aria-hidden beside the button) and a "Manual" button named "Manual p. 1-15".
    - The appendix warning reads "These pages are notes written for this machine, not manual text.", like the Handbook home; copy.test rule (k) bans "owner's own notes".
    - The shopping list footer says "Mark a component Fault"; rule (j) now also bans "Mark/Tick/Set a part" and "a part Fault/OK".
    - Every `n === 1 ? … : …` count ternary goes through `agree()` or `plural()` (DeviceData ×3, HandbookToc, PlayfieldMap, ShoppingList, TabBadge, /tables). Rule (e) now reads the code inside markup expressions for a ternary on 1 whose two words differ only by a plural ending or share a stem, so the markup no longer hides them.
    - Rule (c) also bans a lower-case "broken" in copy (none existed).
    - The flipper-supply Source line on `/coils` names its page, "Flipper Circuits p. 3-10"; spec rule 6 and copy.test rule (l) ban a bare "Source: p. …" link.
    - The README says "page images" and "manual location map" where it said scan(s), and copy.test reads the README for scan(s), US spellings and the flipper connectors.
    - Verify's intro names the two sources once: "Places where the manual's pages and its parts list disagree" (it said "the manual, the parts list and the manual pages").
    - Not changed: the `/coils` flasher rows on a phone are one line taller (106 → 128 px), because the full wire names push the pin pair to its own line. That is §8.9's rule that a label and value pair wraps whole, and the reviewer judged it acceptable. Changing it would change the layout rule for every table.
  - **Recheck fixes** (the reviewer's second pass, same day).
    - The `/switches` segments read Matrix / Dedicated / Flippers. "Flipper J806" named one connector for switches that sit on J805 (the buttons) and J806 (the EOS switches), and "Dedicated J205" overflowed its segment at 360 px. The segment names the group; each panel heading carries the connectors (§6.6, §9.6; tables.spec and shopping.spec updated).
    - The lamp service note (appendix.ts, A4) writes the bulb only when the lamp has one. Lamps 41, 76 and 88 have no bulb in components.json and printed "the bulb () or its socket".
    - The CHANGELOG counts six copy rules, as §13.2 does, and the Diagnose Recent examples in §9 carry the year ("23 Sep 2026").
- **Presentation helpers** (2026-10-01, audit P4 item 1: AR-05, SV-07, AR-16, AR-09, AR-12, AR-14, SV-12, CP-14). A refactor with no visible change: each string or link that several files built by hand now comes from one helper, and the built site is byte-identical. Words, URLs, stored values, keys, ids and anchors are unchanged, as are copy.test.ts, the rules in spec §13 (its helper list is updated) and the e2e assertions.
  - **Helper homes:**
    - `src/lib/copy.ts` holds the vocabulary: `KIND_PLURAL` (was shopping.ts `KIND_TITLE`), `TABLE_LABEL`, `MAP_LAYER`, `LAYER_KIND`, `LAYER_LABEL` (the last three were in `src/lib/data/components.ts`) and `MAP_TITLE`. It also holds `componentName` ("Switch 32"), `tileCode` (the map tile's bare id with the lamp `L`) and `inMatrix`. components.ts no longer exports or re-exports any vocabulary, and it gains `mapOf`, so ComponentCard and ComponentDetail stop pulling components.json into their islands.
    - `src/lib/url.ts`: `mapHref`, `handbookHref`, `tablePath` and `tableHref`. `src/data/appendix.ts`: `appendixHref`.
    - `src/lib/handbook/links.ts`: `tocIndex` and `headingHref`, used by care, setup and the component pages, with `handbookIndex` in toc.ts.
    - `src/lib/pages.ts`: `printedPageText`, `pageCellText` and a suffix on `pageImage` (`_00` tile, `_o` overview).
    - `src/lib/present.ts`: `wiring(kind, item)` (one typed object per kind: the matrix column and row or the wire, part, assembly, fuse and bulb) and `callouts`.
    - The types `Layer` and `MapKind` are in model/types.ts.
  - **Template rule.** Svelte 5 SSR writes indexed hydration markers (`<!--[0-->`, `<!--[-1-->`), so every touched template keeps its block tree: the same `{#if}`/`{:else if}` branches in the same order, and the same `{#each}` and component boundaries. Only the expressions change: `{:else if coil}` becomes `{:else if w.kind === 'coil'}`, never `{:else}`. The wiring helper is a derivation, not a row renderer.
  - **Casts that stay.** `sw?.hint`, `sw?.notShown`, `coil?.note`, and ComponentDetail's `part` and `partLabel` still read the per-kind casts in ComponentCard, ComponentDetail and PlayfieldMap.
  - **Stays hand-typed:**
    - page ranges and en.ts:59;
    - the Matrix header rows and appendix.ts prose wiring;
    - the nav.ts rows (tested equal to `tablePath` and `TABLE_LABEL`);
    - the handbook hub link;
    - the PlayfieldMap shot words;
    - the tables' bare `#` ids;
    - the render.ts link strings, which take a base;
    - the col and row data filters;
    - the pages.ts manual page titles;
    - `src/content` prose.
  - **Lint.** `tests/unit/structure.test.ts` reads src/ with comments blanked. Its 14 checks all fail on HEAD 1a14a76 and pass now:
    - (a) map links are built only in url.ts, and (b) Handbook links only in url.ts and render.ts;
    - (c) the heading index only under lib/handbook;
    - (d) printed page labels and the "p." and "PDF page" templates only in pages.ts;
    - (e) kind and table words, kind-to-path, layer or word maps, and the kind word before an id only in copy.ts;
    - (f) the lamp `L` prefix only in copy.ts;
    - (g) the fuse dash and the callouts only in present.ts;
    - (h) nav.ts table rows equal to `TABLE_LABEL` and `tablePath`;
    - (i) the vocabulary is exported only from copy.ts and never imported from lib/data/components, and kind or layer keys map to capitalised words only in copy.ts.
  - **Tests.** New helper tests sit in copy-helpers, url, handbook, appendix and the new present.test.ts. On HEAD they fail or cannot load their module. There are 33 new unit tests (14 of them the lint), 271 in all.
  - **Proof.**
    - `dist` matches the HEAD build: the 360 html, json, css and webmanifest files (349 pages) are byte-identical after hash normalisation, the 240 binaries are present on both sides, and sw.js precaches the same URL set. No chunk grew by more than 1 KB, and no island closure gained components.json or pages.json.
    - present.ts shares the StatusRow chunk (+796 B), and copy grew by 516 B. The ComponentCard and ComponentDetail closures shrink by about 57 KB each.
    - A client snapshot of the HEAD and new previews matches body HTML byte for byte in 44 of 44 captures, 22 at phone and 22 at desktop size. They cover:
      - map selection of switches 32, D1 and 14, lamps 13 and 76, and coils 05 and 16;
      - the four map lists, and calibration;
      - Diagnose codes and shared faults;
      - two searches;
      - the handbook filter and the Continue reading link, with an empty anchor;
      - the matrix cards;
      - the shopping list.
    - switches.astro imports the lib modules above Matrix: Astro orders page CSS by import position, and a tie put Matrix.css before the `.tabs` style.

## Routes

| Route | Tab | Presentation | Nav key today |
| --- | --- | --- | --- |
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

Some things open as sheets with no URL of their own: Show on map, Add to shopping list, Go to page, Install, All components on the map and About the app (labels as of 2026-10-01). The map layers are floating toggles.

## Keep

- **Split PlayfieldMap** (2026-10-02, audit P4 item 2: AR-06, SV-08, SV-03). A refactor with no visible change, proved against the previous build three ways: the dist is byte-identical for every non-chunk file once hashes, svelte class tokens and the island uid are normalised; 52 of 52 client captures of the map states on phone and desktop are equal in DOM and in a computed-style census; 52 of 52 screenshots are pixel-identical. PlayfieldMap.svelte (2158 to 1471 lines) is the coordinator; `src/lib/map/items.ts` holds the item helpers and types, `src/lib/map/zoom.svelte.ts` (`createMapZoom`) owns zoom, fit, pointers and pinch, `MapCard.svelte` exports the card snippets with their CSS, `MapParts.svelte` is the sheet and panel list, and `MapCalibration.svelte` is loaded with `import()` only under `?calib=1` (§7.10). Two choices the proof forced: the handbook embed list stays inline in the coordinator, because a child component with a root `{#if}` adds hydration anchors to every server-rendered handbook page; and MapCard duplicates `.ph` and `.ibtn*` after `.desel`, because the deselect button lost the coordinator's scoped rules at the boundary and its colour depends on source order at equal specificity. The `/map?z=` TypeError (SV-03) was `flushSync` inside the first-fit effect nulling the current batch; the effect now defers the deep-link zoom with `queueMicrotask`, and `z` is read at two decimals, symmetric with `syncUrl`. Cost: one `preload-helper` chunk (1.4 KB, one extra request per page) and a net +346 B on the map island's closure; the calibration CSS (0.6 KB) still ships because a lazy component loses its scoped CSS, a `?inline` import is deferred to P4 item 5. Guards: three structure lints (PlayfieldMap at most 1500 lines; one overlays.json importer and MapCalibration dynamic, runes, styleless and free of static-side value imports; one home each for zoom, items and the card) and four e2e tests in map.spec.ts.
- **Kit data boundary** (2026-10-02, audit P4 item 3: AR-01, DA-02, AR-03, DA-05, DA-03, DA-04, DA-12, DA-07, DA-09, DA-16). The synced kit (`src/data/kit/*.json`) is imported by exactly three files under `src/lib/kit/` (lint), and `components.json` is translated once, at build time, by a Vite `enforce: 'pre'` transform (`src/lib/kit/plugin.ts`): `translateKit` is closed-world (every key declared verbatim, dictionary, wire or drop; an unknown key or any å/ä/ö left after a final walk throws), so no Swedish reaches the dist and the components chunk shrinks by 4.9 KB instead of shipping the Swedish twins and the dictionaries. Render-time translation (`t()`, `wireEn()` in the components) is gone. Owner data lives in `src/data/ownerNotes.ts` as overlays keyed `kind:id` (`COMPONENT_NOTES` for coil 02's hand-edited note, `COMPONENT_FUSES` for the three magnet coils 16, 23 and 24 with the manual's printed "5A S.B. (under the playfield)", `COMPONENT_WIRES` and `GI_CONFIRMED` for the open G.I. colour question), applied inside the boundary; the kit copy is byte-identical to the kit again. `sync-kit` is a dry run by default (`pnpm sync-kit -- --write` applies), copies an explicit list, keeps a committed sha256 manifest (`src/data/kit/kit-sync.json`) of what was last synced so a local edit is skipped and never overwritten, reports the four diverged kit-docs instead of touching them, and refuses to write while the synced roots are dirty; the dead copies under `public/data` and `src/data/kit` are removed. Conflicts resolved from the sources: the magnet fuse (ops002 footnote), the app101 battery and board location (MACHINE.md, app106), the menu-map P.1 to P.8 links (fall back to the `P.` heading), the three "—" fuse ids (`Fuse.key` slugs); the G.I. colours stay an owner decision as a Verify item that a cross-source test retires on either outcome. Proof: a dist diff whose differences are enumerated per finding with literal gates computed from the previous build (`p4-3-distdiff.mjs`), a Swedish scan of html and chunks (0/0), and 14 cross-source tests (`tests/unit/kit.test.ts`, `sync-kit.test.ts`, handbook, shared-cause, structure lint m).
- **CI and tooling** (2026-10-02, audit P4 item 4: TT-01, TT-02, TT-04, TT-05, TT-07, TT-08, SV-19, TT-10, TT-11, TT-13). Deploys are gated: `.github/workflows/deploy.yml` runs on `push` to main and on `pull_request`, with a `static` job (check, svelte-check, lint, format:check, build, vitest), an `e2e` matrix over the three Playwright projects (phone-dark, desktop-light, phone-webkit), a `build` job (the Pages build, then the link check on it) and a `deploy` job that needs all three and is skipped on pull requests; `tests/unit/workflow.test.ts` pins that shape. The owner's phone is in the matrix as `phone-webkit` (iPhone 13, 390×844, dark) with named gates for WebKit limits (Tab skips links, offline navigation, `mouse.wheel`) and a `KNOWN_SCROLLS` list for the one measured overflow. The motion test's race is fixed in the helper (a DOMContentLoaded wait, and visible retries only for a transition Chrome dropped). Line endings are LF everywhere (`.gitattributes`, `.editorconfig`, `prettier --check .` clean). Local e2e no longer reuses a stale server: `tests/e2e/global-setup.ts` refuses a port 4321 whose `sw.js` is not `dist/sw.js`. `svelte-check` is a devDependency and a gate (0 errors), `z` comes from `astro/zod` (0 `astro check` hints), every fixed wait in e2e is a condition, and two scans guard regressions: axe-core over 26 routes on every project (`tests/e2e/axe.spec.ts`, known findings keyed by project and flagged when stale) and a link check over the built dist (`tests/unit/links.test.ts`). Proof: a dist diff against the previous build that allows only hash re-lettering and the two type-only chunk changes (`p4-4-distdiff.mjs`).
- **Routes.** Every route above, with `build.format: 'file'` and `trailingSlash: 'never'` (static output) unchanged.
- **Base path.** The site deploys under `/<repo>/` (`BASE_PATH`, `.github/workflows/deploy.yml:32`; `astro.config.ts:7-9`). Every internal URL is built with `href()`, `componentHref()` or `manualHref()` from `src/lib/url.ts`, as the nav does today (Base.astro:4, :82). That covers nav.ts entries, back links, hub rows, map deep links such as `/map?layer=sw&id=32`, the icon and splash links, and anything else new. Never write a root-relative `"/…"` link. The manifest's `start_url` and `scope` stay the base-aware `scope` (astro.config.ts:9, :30-31). The manifest has no `shortcuts`; if any are added, vite-pwa doesn't prefix their `url`, so build them from `scope` too. The gauntlet's base-path check enforces this.
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
  - The reader keeps `.pg-bar` per page (the first reads "Appendix A1" on `/handbook/appendix`, with no "Scan" link) and the appendix's `.prov.warn` "notes written for this machine" (appendix.spec.ts:16-21; "owner's own notes" until 2026-10-01).
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
    | --- | --- | --- |
    | smoke:16, :81 | marker names | Phase 2 |
    | smoke:19, :84 | `aside …` | Phase 2 |
    | smoke:68-74 | the "Toggle theme" button on `/` | Phase 3 |
    | shopping:31 | "Broken: Left Flipper Button" sits behind the Flipper J806 tab | Phase 7 |
    | care and setup specs | `getByRole('checkbox')`, if they become `role=switch` | Phase 9 |

## Phases

### [x] Phase 1: tokens and map fit (priority 1)

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
     - Print block (`@media print`, :363-372 resets only `--shadow`): also set `--amber-ink: #000`, `--shadow-1`, `--shadow-2` and `--shadow-sheet` to `none`, and `--raised`, `--cell`, `--sheet`, `--bar` to `#fff`. Hide the floating map controls and `#sw-status` (already listed at :384).
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
- **Done 2026-09-25** on `claude/app-redesign-phase-1` (uncommitted until the owner says so). Gauntlet green: check, lint, 49 unit tests, build, 48 e2e, `data-find` 8, base-path build clean. Deviations from the steps above:
  - The branch is based on `claude/addams-redesign-handoff` (main plus the task files), not bare main.
  - The `embed` prop (Phase 2 step 5) is already on PlayfieldMap: `[section].astro:74` passes it, and `syncUrl()` is a no-op in the embed. Phase 2 only needs to build on it.
  - Markers keep their px size at every zoom (Q5), not just at 1×. The canvas has `overflow: clip` and each marker box is clamped inside it via `clamp()`, or edge markers made the scroller scrollable at 1×.
  - Canvas px sizes are floored so the scroller never gains a 1 px scroll.
  - `.glass` lives in base.css (shared by the controls and `#sw-status`); the Phase 5 shell can reuse it.
  - Light `--ok`, `--warn` and `--brass` darkened to ≥ 4.5 on `--ground` (Q15); the light tints keep the spec values.
  - The wide zoom capsule is vertical; the readout sits at right 68 / bottom 68 as the spec states. `--tabbar-h` ships 0 until Phase 4.
  - Keys: the root handler takes `+ = - _ 0 Escape`; arrows only when the scroller (`tabindex=0 role=region`) has focus. The `/map` window listener is skipped in the embed.
  - Checked by eye at phone-dark and desktop-light: floating column, glass list with counts, readout, legend, side panel.

### [x] Phase 2: map selection, the sheet and the side panel

- **Done 2026-09-25** on `claude/app-redesign-phase-2`. Gauntlet green: check, lint, 49 unit tests, build, 98 e2e, `data-find` 8, base-path build clean. Deviations from the steps above:
  - Open questions settled by the plan's defaults, not the owner: Q12 (phone calibration sheet `max-height: min(470px, 60dvh)`), Q25 (source link at the top of the panel / after the Find field in the parts sheet), Q27 (the faults pill is left out), Q28 (Find a part filters by id, shown id and name), Q29 (only below 600 re-fits; 600–999 keeps the overlap).
  - The wide panel reuses `ComponentCard` (with its `StatusRow`) for the selected part, under a "Switch 32" heading with Deselect, instead of the spec's bespoke layout; the phone sheet has the bespoke header, wiring rows and link grid.
  - Lamp rows and the sheet show the id as the DMD does (`L13`); the marker names follow spec §7.5.
  - The zoom FLIP and the new canvas transitions coexist by setting `transition: none` inline during the zoom step; the `.ready` class turns transitions on only after the first fit so the Phase 1 fit tests hold.
  - Under reduced motion the controls still fade (120 ms) and the sheet fades in (150 ms); the e2e check allows fades and forbids everything else.
  - The embed's aside keeps today's layout; its e2e check waits for the fit before clicking (the marker moved under the click otherwise).

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
     - At 1× below 600 the drawing re-fits to stageH − 96 and the controls move 12 above the sheet. For 600–999 the spec's code sets `phone = max-width: 599px`, so nothing re-fits and the sheet covers the drawing's bottom; Q29 settles whether tablets re-fit too.
     - Expanded, at 1×: the scroller is `overflow: hidden` and can't scroll, so the canvas moves with `transform: translateY(…)` until the part's centre sits mid-band in the uncovered band (spec §7.6: top −79.8 at 390×844). Above 1× the scroller scrolls instead (spec §7.1 `centre()`, with the uncovered band as the height). Collapse returns the translate to 0. The translate runs with the sheet's snap, 350 emphasized (board Motion: "Drawing, on expand y 0 to −79.8 … 350 emph"); under reduced motion it jumps inside the snap's 150 ms fade.
     - Expanded hides the controls (120 ms fade). Deselect re-fits.
     - Content per spec §7.6. Shots keep the shot-card content and `data-id`.
  3. Below 1000, the parts list leaves the page. The `aside` under the stage (PlayfieldMap.svelte:363-414) isn't rendered below 1000, or the page scrolls. Its content moves into a modal BottomSheet "All parts on the map" (large detent until the board gives one, spec §8.2):
     - Opened by an interim `.glass` 44×44 ibtn "All parts on the map" at the top of the right control column. Phase 5 moves it to the top bar.
     - At the top of the sheet: a search field "Find a part" that filters the rows by id or name as you type (Q28), then the layer-source link (Q25), then the provenance paragraph (`.prov`, :384-388).
     - Then the list per visible layer, one `h3` per layer as today. Picking a row closes the sheet and selects the part (the selection sheet opens at peek).
  4. From 1000, the panel `aside` "Selected part and parts on the map" (spec §7.7):
     - The selected part, with the status segmented control wired to the status store.
     - With nothing selected: today's empty card (the h2 "Playfield", the hint "Tap a marker on the drawing, or pick from the list." and the `.prov` paragraph, :381-389) takes the selected-part section. Below 1000 the card isn't rendered at all: with nothing selected the phone shows only the fitted drawing and the controls, and the `.prov` paragraph lives in the All parts sheet (step 3). The hint has no home on phones.
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

### [x] Phase 3: hubs (`/tables`, `/workshop`), the list vocabulary, Appearance

- **Done 2026-09-25** on `claude/app-redesign-phase-2`. Gauntlet green: check, lint, 49 unit tests, build, 108 e2e, `data-find` 8, base-path build clean, `theme-toggle` gone from `src`. Deviations from the steps above:
  - The Verify checklist data moved out of `verify.astro` into `src/data/verify.ts` (`VERIFY_ITEMS`) so the hub can count "N of 13" against the real ids; the page imports it. The data has 13 items, matching the board.
  - `allShoppingItems()` in `src/lib/shopping.ts` builds the shopping candidates for both `shopping.astro` and the hub (was inline in the page).
  - `coils.astro` got `id="flippers"` and `id="gi"`, and `DeviceData.svelte` got `id="device-data"`, so the hub rows can link to them.
  - Appearance, Offline and Version are labelled static rows (`div.lrow.static`), not links or buttons; the e2e check allows exactly those. Offline shows "Ready" once a service worker controls the page, else nothing.
  - Machine setup shows "N of M" done items only once one is ticked; Care's subtitle takes the first care step's title.
  - The precache check is `grep -c '"tables' dist/sw.js` (the manifest strips `.html`; the plan's grep for `tables.html` finds nothing).
  - The list vocabulary uses global classes `.lst`, `.lst-h`, `.lrow`, `.gf`, `.seg`, `.toggle`, `.chip`, `.pill`, `.code`, `.hint`, `.btn.sm`, `.search` (PlayfieldMap keeps its own scoped `.rows`/`.row`).

- **Goal.** The two new tab roots exist, built from the list-row, group and segmented styles. The theme control moves into Workshop → Appearance. They are reachable from today's nav strip.
- **Boards.** Tables, Workshop, Components (§04, §05), Native (theme), Rationale (§04, §05).
- **Files.**
  - `src/styles/base.css` (edit: spec §8.3, §8.4, §8.6, §8.7)
  - `src/pages/tables.astro` (create)
  - `src/pages/workshop.astro` (create)
  - `src/components/WorkshopHub.svelte` (create: a `client:load` island for the rows whose counts come from the device, the "About this handbook" sheet and the Appearance control; it imports the status store, verify-store.ts and setup.svelte.ts. workshop.astro renders the static rows itself and mounts this island for the rest, since an `.astro` page can't read localStorage at build time)
  - `src/lib/verify-store.ts` (create: `KEY = 'tafh:verify'` and `loadVerifyTicks()`, moved out of verify-check.ts:5-15)
  - `src/lib/verify-check.ts` (edit: import them; it keeps its self-run `initVerifyChecks()` at :54, so the hub must not import verify-check.ts)
  - `src/layouts/Base.astro` (edit: add Tables and Workshop to the interim NAV; remove `#theme-toggle` at :75-77 and its inline script at :100-115)
  - `src/styles/base.css` (edit: also drop `#theme-toggle` from the print list, :383)
  - `tests/e2e/smoke.spec.ts` (edit :68-74)
  - `tests/e2e/hubs.spec.ts` (create)
- **Steps.**
  1. List and group, segmented, toggle, pill and chip CSS per the spec.
  2. `/tables` per spec §9.5:
     - Counts come from `src/data`.
     - "Recently viewed" stays hidden until Phase 7 fills it.
     - What the "Search tables" field filters isn't drawn [confirm on board Tables].
  3. `/workshop` per spec §9.14:
     - The counts come from the status store (`groupFaults`), `loadVerifyTicks()` and `setupItems()` (src/lib/model/setup.svelte.ts:55). They are read on the device, so the rows that carry a count render inside WorkshopHub.svelte; the count is empty until hydration, never a build-time 0.
     - "Device data" links to its current home until Q7 settles.
     - "Install app" stays hidden until Phase 11.
     - The Version comes from package.json.
     - The last group ends with a row "About this handbook" (inside WorkshopHub.svelte). It opens a modal BottomSheet (Phase 2) holding the footer's copyright paragraph (Base.astro:93-97), word for word, and the Version.
     - No count or badge on the hub uses `role=status` or `<output>` (Keep → Accessibility).
  4. Appearance (inside WorkshopHub.svelte): a segmented group named "Toggle theme" with System / Dark / Light.
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

### [x] Phase 4: navigation shell (tab bar, rail, sidebar)

- **Done 2026-09-25** on `claude/app-redesign-phase-2`. Gauntlet green: check, lint, 49 unit tests, build, 138 e2e (shell.spec adds 15 per project), `data-find` 8, base-path build clean. Deviations from the steps above:
  - One `nav.shell aria-label="Sections"` is rendered from `src/lib/nav.ts` and CSS gives it the three forms (tab bar < 600, rail 600–1279, sidebar ≥ 1280); the sidebar's sub-rows and logo exist in the DOM at every width but display only from 1280. One landmark, not three.
  - New token `--shell-w` (0 / `--rail-w` / `--sidebar-w`) is the shell's left column; `body` pads by it and by `--tabbar-h + --safe-bot`, so every page and the fixed `#sw-status` clear the shell. `--tabbar-h` is 49 below 600, 0 from 600 and in print.
  - The badge and the sidebar's count pill are one island, `TabBadge.svelte` (`pill` prop). It counts Fault rows among the Shopping list's candidate keys (Q6 default: rows, and "Add to list" still means mark Fault), renders nothing at 0, and sets the Workshop link's `aria-label` from inside the link. The sidebar hides the badge and shows the pill; the link still carries the count in its name.
  - Q2 default: tab 5 is Workshop. Q7 default: Device data links to `/shopping#device-data`. Q9: `/404` stays inside the shell. Q10: the sidebar search field is left out until the owner answers; the header brand row and QuickSearch stay, but the header's brand hides from 1280 where the sidebar carries the logo.
  - The map's phone calibration sheet is fixed at `left: --shell-w; bottom: --tabbar-h + --safe-bot`, and the map-kind BottomSheet sits at the stage bottom (`bottom: 0`, no longer `-safe-bot`) since the tab bar owns the safe area.
  - map.spec's peek test measured the control column against a sheet top captured while the sheet was still rising; it now compares live values. The reselect test waits for `load` before the second click.
  - Rail items are 80×64 with the current icon on a 56×32 `--tint` pill (done with padding on the SVG). Icon paths are stroked 24-grid glyphs drawn here; the boards' exact glyphs are not in the repo.

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

### [x] Phase 5: top bar, back links and token migration

**Done 2026-09-25.** Deviations and notes:

- One `header.top` for every page, driven by a `h1` prop on Base (`large` | `page` | `bar`). Tab roots render the large title in `main > .lt` and Base's inline script drives `--ct`/`--lt` from the scroll position (40–52 fade, hairline at 52, reduced motion swaps at 52). From 600 the `.lt` row is clipped (sr-only style) so the bar carries the title, and the compact title is always opaque.
- Back links come from `PARENT` in `~/lib/nav` by nav key; ComponentPage, the manual viewer and 404 pass explicit `back` props (component pages use the plural list label: Switches, Lamps, Solenoids). The manual viewer keeps a one-line doc link under the bar so the doc is still reachable.
- The old header brand row, its QuickSearch mount and the `--topbar-h` ResizeObserver are gone; the token is static per breakpoint. QuickSearch mounts on `index.astro` until Phase 6 replaces it. Q10 sidebar search still omitted.
- The Map's bar buttons live in `map.astro`'s `actions` slot and talk to the island through a `tafh:map` CustomEvent (`find` focuses the panel field on wide layouts, otherwise opens the sheet; `parts` opens the sheet). The interim in-map "All parts" glass button is removed.
- Tokens: `--r`, `--nav-h` and `--shadow` removed; all uses renamed to `--r-xs`, `--safe-top + --topbar-h`, `--shadow-1`. Every hover rule now sits inside `@media (hover: hover)`.
- Tests: `tests/e2e/shell.spec.ts` gained the Phase 5 block (collapse, reduced motion, back-link table, map bar buttons, anchors under the bar, 50/56 bar heights). The reselect test polls the initial scroll because the parts table can still be laying out right after hydration.
- (2026-09-30, audit P2 item 1, VP-03/AY-13) The phone bar's `1fr auto 1fr` grid gave the title its width (up to 220) first and each side only what was left, 42 px at 320, so a nowrap back label ran over the title (41 of the 349 routes at 320, 10 at 360, 7 at 412). The base `.top .tb` columns are now `minmax(var(--touch),1fr) minmax(0,auto) minmax(var(--touch),1fr)` (the 1280 block still replaces them): the title takes its width first, the sides share the rest and keep 44 px each for the chevron or a trailing ibtn, and the title stays centred. Under 1280 `.back` wraps (`flex-wrap: wrap`, `align-content: flex-start`, `overflow: clip` in `@supports` over `hidden`, `min-width: 0`, `max-width: 100%`; the svg padded to a `--touch` line, the label at line-height `--touch`, the link `--touch` tall), so a label that does not fit its side falls onto a second line outside the 44 px box and only the chevron shows. A label is either whole or gone, never cut, and it stays the link's accessible name (no aria-label, since motion.ts writes the span). Wrapping was chosen over a container query that hid every label under a fixed 120 px side: that hid labels that fit ("Tables", "Results" at 320) and did not follow the text size. The 1280 block (left-aligned title, `.lead:empty`) is unchanged, and on a direct load the header is pixel-identical from 600 to 1440; a page opened from one of the ten short-title pages reads the short as its back label at every width, 1440 included (accepted, a short parent label is the usual pattern). Short titles (the phone bar's title under 600; the in-page h1, the document title and the bar from 600 keep the full title): quick "Quick reference", rules "Rules", setup "Assembly", menus "Menus", presets "Presets", adjustments "Adjustments", errors "Error codes", maintenance "Maintenance", appendix "Appendix" (`Section.short`, passed by `[section].astro`), and /fuses "Fuses". Base renders the `.full`/`.short` spans in the aria-hidden `div.ct` branch too. As `html[data-label]` is `short ?? heading`, a page opened from one of these reads the short as its back label ("Menus", "Fuses"). Result at 320/360/412: no overlaps and no title ellipsis on any route; the label collapses to the chevron on 37/1/0 of the 349 routes (at 320 all 28 /coil pages, whose "Solenoids" label meets "Solenoid NN", the quick, setup, tests, adjustments, errors, maintenance and appendix sections, /setup and /shopping; at 360 quick; a first count of 10 came from a 31-route sample). Review follow-ups: `clip`, not `hidden`, because `hidden` makes the link a scroll container that find-in-page or `scrollIntoView` can scroll the cut label into (the minifier drops a duplicate `overflow`, hence `@supports`). A collapsed link keeps its whole side as the tap area, but Base's inline script mirrors the wrap into `data-bare` (a ResizeObserver on the link and its label, so motion.ts rewrites count), and a bare link draws its focus ring (inset, as `.back` clips) and hover pill round the chevron only, 36×44, instead of round an empty box whose ring ran 4 px into the title. Tests: `tests/e2e/header.spec.ts`.

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

### [x] Phase 6: Diagnose home, results and search (the entry point)

**Done 2026-09-25.** Deviations and notes:

- Q16 default: Recent keeps 8 entries under `tafh:recent`, recorded on Diagnose, Enter (one-line field) or blur, only when at least one code was recognised. The top entry's counts re-sync when a card is marked Fault while the same input stays in the field.
- The "Recent reports" bar button clears the field and focuses the Recent/Try heading (via a `tafh:diag` document event from the page script).
- Q20 default: Parts and the manuals' OCR text are searched too; the handbook TOC, OCR text and parts list are fetched lazily the first time the search state opens.
- `QuickSearch.svelte` is deleted; `DiagnoseSearch.svelte` replaces it (chips All/Components/Handbook/Manuals/Parts, five rows per group in All with "Show all N").
- The "1 of 4" chip counter is not implemented; the results bar shows "N codes" and the codes as chips below it.
- Share results uses `navigator.share` when available, else copies the text to the clipboard.
- The field docks low via flex on the home (`min-height` from the shell tokens) and floats sticky above the tab bar over results and search.
- The §8.5 card anatomy was applied to `ComponentCard` globally (so the map panel and component pages carry it too). `StatusRow` is now a `.seg`; the global `.card` is `--cell`/r-md/inset hairline, with `.lifted` for the shadow. `MiniMap` gained `w`/`h` props (310×120 in cards).
- `/handbook` still carries duplicate section links from the TOC widget; Phase 8 rebuilds that hub.
- New e2e file `tests/e2e/diagnose.spec.ts` (242 e2e in total); it waits for the layout to settle before tapping Diagnose.

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
  7. Remove the QuickSearch mount from index.astro (Phase 5 parked it there); the field's search state replaces it. Keep `?q=`. The sidebar search from 1280 waits for Q10.
- **Acceptance.**
  - At 390×844 with fresh storage, the quick links, the examples, the field and the Diagnose button are all visible without scrolling, and the field sits above the tab bar. The Diagnose button's centre is in the lower half of the viewport (thumb reach).
  - Tapping the example "32 68 F1 F3" gives 4 `article.comp` and the J806 shared-cause card, with no button pressed.
  - Fill "32 68", press Diagnose, reload: "32 68" is the first Recent entry. Filling the field without pressing anything and without leaving it records nothing.
  - Typing "flipper" shows the search chips and grouped results. Cancel restores the home. "row 5" and "Check Switch 32" never show the search state.
  - `/handbook` links to `handbook/tests` and `handbook/errors`, `/tables` to `fuses`, and `/workshop` to `verify`, `setup` and `care` (one `a[href$=…]` each).
  - smoke "diagnose resolves…" and features :4, :13, :22 pass unchanged.
- **Verify.** The gauntlet, plus `pnpm exec playwright test tests/e2e/diagnose.spec.ts tests/e2e/features.spec.ts tests/e2e/smoke.spec.ts`.

### [x] Phase 7: Tables screens and component detail

**Done 2026-09-25.** Deviations and notes:

- `/switches`: the tablist "Switch matrix view" (Matrix / Dedicated J205 / Flipper J806) with `aria-selected`, `aria-controls`, roving tabindex, arrow keys, Home/End; `#j205` / `#j806` open that tab. All three panels render at build time, inactive ones `hidden`, so every `input.fault-check` (16) loads its state. The Search ibtn of §9.6 is not drawn (Diagnose search covers it).
- The matrix cell card shows for the highlighted cell and then for whichever cell has focus (keyboard); a tap on a cell still opens the page directly, so "Open" mainly serves keyboard and pointer users.
- Component detail is a new island `ComponentDetail.svelte` (§9.7): header with the code, kind line and the live status word, the status `.seg` and Note, then Wiring, Parts (part + assembly), Location (Show on map, "Callout N on p. 2-NN", the hint), Related, Service log and the device note. `ComponentPage.astro` keeps the `.notes` block and the appendix links. No "More" button (nothing defined for it); the back link stays the list page (not "Results").
- Q6 default: "Add to list" marks Fault and then turns into an "On the list" link to Shopping. No SwitchShop sheet.
- Q18 open: the prev/next pager stays at the bottom of the page as two small buttons (the board omits it; one line to remove).
- "Related" lists components with the same name first (the jet bumper's lamp L22 and coil SOL 10 for switch 32) and then those on the same assembly, capped at 8; the spec's "On the same jet bumper" heading is the generic "Related".
- Show on map is a `BottomSheet` modal at the large detent: a responsive MiniMap crop (2.4× zoom, 46 px marker) with the neighbours of the same kind as labelled dots (new `others` and `ring` props), the callout line, "Open in Map" and "Manual page". Esc/Close return focus to the row; the rest of the page is inert.
- `StatusRow` gained `log={false}` so the detail page draws its own Service log section (still `aria-label="Service log"`, one per page).
- Recently viewed: a `tafh:viewed` list (8 entries) in `recent.svelte.ts`, recorded on mount of the detail page with the code, name and kind line; `/tables` fills `[data-recent]` from it in its page script and the search filter includes the group.
- shopping.spec.ts: the one added tab click before ticking "Broken: Left Flipper Button". New `tests/e2e/tables.spec.ts` (258 e2e in total).

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

### [x] Phase 8: Handbook, Manuals, Parts

**Done 2026-09-25.** Deviations and notes:

- Segmented links: a new `DocSeg.astro` (`nav[aria-label="Handbook, Manuals or Parts"]`, `a[aria-current="page"]`) on `/handbook`, `/manual` and `/parts`; base.css now styles `.seg > a` like `.seg > button`.
- Handbook home (§9.10): the search field is the TOC widget in `home` mode ("Search the handbook and scans"): it filters headings while typing and ends with "Search the scans for …", which opens `/manual?q=` (ManualSearch now reads `q` on load). Continue reading is one entry under `tafh:reading` (new `src/lib/model/reading.ts`), written by the reader on load and as page bars scroll through the upper viewport (Q16-style: last page seen). The sections list shows the printed page range where it is contiguous (Utilities and Quick reference show none).
- Reader (§9.11): back link "Handbook", "View the scan" `.ibtn` in the bar (first page of the section, none for the appendix), the fixed bottom toolbar `ReaderBar.svelte` (`nav[aria-label="Reader"]`, `.glass`). Q17 default: it pages by section; the ends show the adjacent section's nearest page label ("1-14" / "1-20" for Test menu) with `aria-label="Previous: …"`. Contents opens the TOC in a large sheet; Text size opens a medium sheet with Small / Default / Large (`tafh:text`, `data-text` on `<html>`, applied by an inline script before paint). The desktop Contents aside stays from 960; below that the sheet replaces it. The sheet recedes only the bar and footer (a scaled tall article would shift the text).
- Viewer (§9.12): `role=toolbar` "Page": Previous page, "97 / 124" (`aria-label="Go to page (97 of 124)"`), Next page, Rotate page, Text. Go to page is a medium modal sheet with the Page field (autofocus), Done and Go; it also accepts a printed number ("2-39") on the Operations Manual, and marks a bad entry inline. Zoom out / Fit / Zoom in are a `.glass` capsule (`role=group aria-label="Zoom"`, 44 px `.ibtn`s) bottom-right over the scan. The key hint shows from 1000 or under `(hover: hover)`. The document segmented control links the same page on the current document and page 1 of the others. Contents shows the seven entries around the page (current marked `aria-current="true"`), plus "Read the transcription" and "All contents"; the footer line and the OCR search (no longer inside a `<details>`) follow. The bar title gets a `short` form ("p. 2-39") on phones.
- Manuals index: the three documents as `.lst` lists with the same footer line; ManualSearch stays under the segmented links.
- Parts (§9.13): "Search parts" with "Clear search" (refocuses the field), the count as "N rows" (`.count`, `role=status`), four columns Item / Part no. / Description / Qty; the assembly path sits under the description while searching. `<table class="t">` and `tbody tr` unchanged.
- New `tests/e2e/handbook.spec.ts` (26 tests; 284 e2e in total). smoke, appendix and `#pg-9` pass unchanged.

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

### [x] Phase 9: Workshop screens

Done 2026-09-25. Deviations and decisions: Shopping list rows use the list vocabulary (a header row per part "1 × #555 (24-8768)", then one row per component with the `{ref} {name}` link and a visible "Fixed: {name}" button, so the test contract holds); a full swipe to the left (past the 88px `--bad` pane that reveals under the row) commits Fixed on release, a shorter one snaps back, and a mostly vertical drag scrolls (pointer events, `touch-action: pan-y`). "Share" uses the Web Share API and only renders where `navigator.share` exists (Copy as text is the fallback); "Show text" and the textarea stay, the export text is unchanged. Footer "Mark a part Fault and it lands here. Fixed clears the fault." The Service kit is a static grouped list after the shopping list with its note as the footnote. Device data (Q7 default: stays on /shopping as `#device-data`) is a grouped list: recorded line, Download backup, Read backup…, "When reading" with the Import mode select, and "Clear all" as a `.lrow.danger` row that keeps its second tap ("Really clear all?"); the empty row says "Nothing saved on this device yet." so the "not recorded" test still holds. Verify and Setup/Care (Q19: bodies not drawn): styles only, rows and tick targets are at least 44px; no `role=switch` toggles, because none of these boards show a toggle, so the checkboxes and their test selectors stay. No test edits; e2e 284.

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

### [x] Phase 10: install surface (meta, icons, manifest, splash, standalone)

Done 2026-09-25. Both Apple meta tags, `icons/icon-180.png` and the 1170×2532 startup image with its media query are in the head (all through `href()`); the manifest has `orientation: any` and a separate `icons/maskable-512.png`. `scripts/icons.mjs` now renders icon-192/512 (as before), the opaque 180 square (the SVG's `rx` stripped), the maskable 512 (art in the centre 80%) and the startup image (icon 120 pt centred, the name 22 pt 16 pt below it in `--ink`). The name's outlines were converted once with fontkitten (already in node_modules, not a new dependency) into `scripts/splash-name.svg`; the script prints `opaque` for each PNG from `sharp().stats()`. Safe areas: the top bar and tab bar already used the tokens; `.wrap` now pads the sides with `max(var(--pad), env(safe-area-inset-left|right))`. The iPhone check (standalone, splash on 390×844, notch and home indicator, the white clock on the light theme) is the owner's; not done here. No test edits; e2e 284.

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

### [x] Phase 11: system states (toasts, install sheet, offline scans, pull-to-refresh)

Done 2026-09-25. Toast.svelte (one host in Base, `aria-live=polite`, no status role; one toast at a time, Update wins and stays, others leave after 4 s) replaces `#sw-status`; pwa.ts talks to it through `tafh:toast` and takes `tafh:reload` / `tafh:check-update` back. InstallSheet.svelte from the Workshop's new "Install the handbook" row (static "Installed" row when standalone); lib/install.ts keeps the deferred `beforeinstallprompt`. PageViewer shows the scan-not-cached card on `img` error with "Show the text". Pull-to-refresh on the Workshop only (touch drag from the top past 72 px → `tafh:check-update` → toast). Deviations: (1) Q22 — the Install button appears only where `beforeinstallprompt` fired; the iPhone footer always shows. (2) The update check caps `registration.update()` at 3 s so the toast always arrives. (3) The offline-scan e2e aborts the `/assets/pages/**` requests instead of `context.setOffline` (the page is not worker-controlled on a first visit under Playwright); the same `onerror` path fires. (4) The shell.spec `#sw-status` test became the toast test and waits for the rise animation before measuring. e2e 284 → 302.

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

### [x] Phase 12: motion and navigation continuity

Done 2026-09-25. Decisions and deviations:

- Q11 → cross-document view transitions (`@view-transition { navigation: auto }`), no Astro ClientRouter: the worker, hydration and every page script stay as they are. The type (push/pop/tab/fade) is set in an inline `pagereveal` listener in Base's head from the `tafh:prev` record (motion.ts writes it on pagehide) or the history direction; CSS keys on `html:active-view-transition-type(...)`.
- Named captures: top bar (`topbar`), shell (`shell`) and toast host (`toast`) cross-fade in place; the root slides on push/pop and cross-fades on a tab tap. `<link rel="expect" href="#main" blocking="render">` so the new snapshot is complete.
- Chrome skips the cross-document transition while the worker precaches on a first visit, and now and then under parallel test load (never with one worker); the page falls back to a plain swap. The transition-reading tests wait for `serviceWorker.ready` and, on an observed skip (`window.tafhMotion.type === 'none'`), step back and repeat the navigation.
- Swipe back is touch-only: passive listeners on `#main`, 24 px edge, commit past 35 % of the width or 500 px/s, else spring back; tested via CDP touch events on the phone project only (2 tests skip on desktop).
- Per-tab stack: tab links open the tab's last view (sessionStorage `tafh:nav`), scroll is restored per URL, the Map keeps zoom in `?z=` (with `layer`, `id`, `calib`).
- (Revised 2026-09-29, audit P1 item 7) Diagnose names its view (`body[data-view]` = Results/Search) and the URL its state answers to (`body[data-url]` = `/?q=…`) for motion.ts. Once results or a search are committed (Enter, Diagnose, the field losing focus, a link followed from the view, a Recent or Try row, or `?q` on load), Diagnose writes `?q` with replaceState, never a push, so system Back from a card and a reload return to them. The string is exactly `?q=` + `encodeURIComponent`, the same as `body[data-url]`; typing on while committed follows 250 ms after the last key, or at once when the page is hidden or left, except into the back/forward cache, where the write waits for the restore (a reload inside those 250 ms still loads the query before the edit). Clear, Cancel, Recent, reselect and emptying the field return to the clean `/`. Typing before a commit leaves the address as it is. The back link of a page opened from Results reads "Results" and lands on `/?q=…`.
- (2026-09-29, audit P1 item 7) Header and swipe back traverse history (`history.back()`, once per page) when the previous entry is the target, otherwise they replace the page with the target (a cold link, or a target that is not the entry before), so Back never returns to a dismissed page. The previous entry comes from the Navigation API, else from the `from` stamped on the entry: the referrer after a push into a tab that already has history (never in a new tab, whose history is one entry), carried over by a replace. A link followed while a back or a page turn is still loading clears their marks, so the page is left as that link. Each entry stores its back link in `history.state.tafh` when it is created; reload, Back/Forward and restores show that link, and an entry without one gets the static parent, never the override. The override (a page opened from elsewhere points back there) needs a `tafh:prev` record under 10 s old and a same-origin referrer, and applies across tabs, to a push down within a tab from a page that is not the parent (a Handbook section → a manual page reads "Test menu"), and to manual paging, which replaces the entry (Prev, Next, the arrows, Go to, the viewer's contents rows) and inherits the replaced page's link. Any link in the shell (tab, sidebar row, logo) keeps the static parent and cross-fades. Labels are `data-view`, else the page's short title or heading ("Verify", "Shopping list"). Depth is 1 under a tab root and 2 below that. A back that replaced pops; a swipe back only fades. Swipe back never commits on `touchcancel` and is off in an iOS Safari tab (`navigator.standalone === false`), which has its own. A page restored from the bfcache drops a leftover slide, timer and flags and re-points its tab links. The Map writes `id=kind:id` (`lamp:55` is not `switch:55`); the link builders keep the bare id with their one `layer`.
- "The title fades into the back button" is approximated by the top bar's own cross-fade; the tab icon presses to .9 via `:active`. Under reduced motion every old/new snapshot only fades over 150 ms, groups do not move.
- `window.tafhMotion` is a diagnostic for the tests (type, animations, pending/skipped).
- Gauntlet: check 0 errors, lint clean, 57 unit tests, e2e 302 → 318 (316 passed, 2 skipped on desktop), data-find 8, `"tables` in sw.js, one h1 per page, base-path build clean.

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

1. **The uncommitted workshop-mode slice** (`mobile-redesign.md`, plus the diffs in `tokens.css` and `base.css`: `--tabs-h`, `--type-base`, the `data-mode='workshop'` blocks; uncommitted in the `addams-handbook-mobile-redesign-fc850f` worktree, not on `main`). It conflicts with the Workshop tab and uses another tab set. Discard it, or keep `--type-base` and the higher-contrast values? *Phase 1.* **Answered 2026-09-25: discard it entirely.**
2. Tab 5: Workshop (the default, as the board recommends) or Shopping list? *Phase 4.*
3. **Theme default.** Native says "Dark is the default" and also "System clears it". Today no stored key follows the OS. Which should no key mean? *Phase 3.*
4. **The data-find bar.** `appendix-integration.md:50` says 0; the last green run recorded 8 (`grep -ro 'data-find=' dist --include=*.html | wc -l`; `grep -c` under-counts the compressed HTML). Which is the target? *Every phase.* **Interim: 8 is the baseline; add none.**
5. Marker sizes: above 1×, constant or growing (MapZoom draws 26 px at 2.4×)? And the shot marker's 16 px at 1× isn't drawn on any board: confirm it. *Phase 1.* **Answered 2026-09-25: constant px above 1×; shot 16 confirmed.**
6. SwitchShop's quantity and part-or-assembly choice change the derived shopping list into stored lines, and change what the badge counts (rows or units). Build it, or keep "Add to list" = mark Fault? *Phases 4 and 7.*
7. Device data: its own page, a section on `/workshop`, or stay on `/shopping` (where features.spec opens it)? *Phases 3 and 9.*
8. `/coils`: the three Tables rows (Solenoids & flashers, Flipper coils, GI). Anchors on `/coils`, or separate pages? *Phase 3.*
9. `/404`: inside the new shell, or the TILT page alone? *Phase 4.*
10. The sidebar search field from 1280: is it QuickSearch, a link to Diagnose search, or nothing? *Phase 4.*
11. Page transitions: Astro ClientRouter (unproven here; it touches the service worker and hydration), cross-document view transitions, or CSS only? *Phase 12.*
12. Calibration's medium detent on phones: ≈470 like the modal? *Phase 2.*
13. The height of the handbook embed stage (`#pg-9`). *Phase 1 (an interim default is set).*
14. Body text 16 (today) or 17/24 (kit)? *Phase 5.*
15. Light-theme contrast on `--ground`: `--ok` 4.19, `--warn` 3.46 and `--brass` 4.08 are under 4.5. Darken them, or restrict them to icons and large text? *Phase 1.* **Answered 2026-09-25: darken the light values to ≥ 4.5 on `--ground`.**
16. Recent items (Diagnose's recent reports, Tables Recently viewed, Continue reading): how many, which key, and do they go in the backup file? The recording rule is set (Phase 6, step 4: on Diagnose, Enter, or leaving the field with a recognised code); confirm it. And what does Main's top-bar ibtn "Recent reports" open (the full history, or nothing until there is one)? *Phase 6.*
17. HandbookReader's per-page pager (1-14 / 1-16): does it replace today's per-section navigation? *Phase 8.*
18. The ComponentPage prev/next pager isn't on the Switch board. Keep it? *Phase 7.*
19. The Care, Setup and Verify bodies aren't drawn. Restyle only, keeping their content and tests? *Phase 9.*
20. DiagnoseSearch scope: do parts (2,562 lines) and manual OCR go in the index, loaded lazily? *Phase 6.*
21. The selected-marker pulse: once (board) or looping (today)? *Phase 1.* **Answered 2026-09-25: once.**
22. Install: a custom sheet on `beforeinstallprompt` (Chromium), with the iPhone text as the fallback? *Phase 11.*
23. Add a 390×844 Playwright project? The tests use `setViewportSize` meanwhile. Note that map.spec (Phase 1) sets 1440×900 inside the phone-dark project, which emulates a Pixel 7 (`isMobile`, touch): a wide viewport under mobile emulation is not the desktop case. The recommendation is a phone project at 390×844 plus running the wide sizes only in desktop-light. *Phase 1.*
24. Drop the `valvet:theme` and `valvet:status` legacy fallbacks? *None.*
25. Where does the layer-source link go on the new map ("Playfield Shots, PDF pages 9–10" and the others)? It isn't drawn. *Phases 1 and 2 (meanwhile it sits at the top of the aside from 1000 and at the top of the All parts sheet on phones; never under the stage, which would scroll the page).*
26. The expanded-sheet links. MapExpanded shows Details / Manual / Switch matrix / On the shopping list; MapFitSpec's schematic shows other labels. Confirm MapExpanded? *Phase 2.*
27. What does the "Show faults, N" pill do (filter the markers, or open the list)? And where does it sit: the Map board draws it at top 632 (about 103 above the stage bottom, level with the control column's lower capsule), not 12 above the stage bottom (spec §7.3). *Phase 2.*
28. What does the Map's "Find a part" ibtn do? It's on Map, ShellTablet and ShellDesktop, but its result isn't drawn. The proposal: it opens the parts list with a "Find a part" field focused that filters by id or name (the All parts sheet on phones; the panel list from 1000). *Phases 2 and 5.*
29. On 600–999 the selection sheet covers the drawing's bottom without a re-fit (spec §7.1 `phone = max-width: 599px`; MapFitSpec draws no tablet selection). Re-fit there as on phones, or accept the overlap? *Phase 2.*
