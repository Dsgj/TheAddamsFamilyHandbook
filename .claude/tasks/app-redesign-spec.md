# App redesign: spec reference

**Status 2026-09-25: design values taken from the canvas (32 boards). This file is the reference when the canvas can't be read.**

- Canvas: https://claude.ai/artifact/UafRUTDKLxz4RYNuLmeeuh (private to the owner's claude.ai account). To read a board, use the Artifact tool with action "read", that url and path `project/<Board>.dc.html`.
- The 32 boards are grouped by what they cover:
  - Decisions: Rationale.
  - Map: MapFitSpec, Map, MapLight, MapPeek, MapPeekLight, MapExpanded, MapZoom.
  - Shells: ShellTablet (1180×820) and ShellDesktop (1440×900).
  - Diagnose: Main, MainLight, DiagnoseResults, DiagnoseResultsLight, DiagnoseSearch.
  - Tables: Tables, SwitchMatrix, SwitchMatrixLight, Switch, SwitchMapSheet, SwitchShop.
  - Handbook: HandbookHome, HandbookReader, ManualViewer, Parts.
  - Workshop: Workshop, Shopping, Install, Update.
  - Specs: Components, Motion, Native.
- Phone boards are 390×844. Their safe areas are 47 at the top and 34 at the bottom; the tablet's are 24 and 20. All sizes are CSS px.
- "Kit" means the shared stylesheet inlined in every board: open any board and read its `<style>`.
- The rules for disagreements:
  - A screen board beats a schematic.
  - A spec board (Components, Motion, Native) beats the kit.
  - Anything still unsettled is marked **[confirm on board X]** and listed in the task file under "Open questions".
- The repo's class names stay: `marker k-sw`, `k-lamp`, `k-coil`, `k-shot`, `.sel`, `article.comp`, `.shot-card`. Take the kit's values, not its class names (e.g. its `mk` markers).

## 1. Tokens

Source: Components §07 (it matches the kit). Each light value goes into **both** light blocks of `src/styles/tokens.css`: `:root[data-theme='light']` and the `prefers-color-scheme: light` block.

### 1.1 New colour and shadow tokens

| Token | Dark | Light |
|---|---|---|
| --raised | #221d26 | #fffcf5 |
| --cell | #1a161d | #fffcf5 |
| --sheet | #1c1720 | #f3eee2 |
| --sheet-cell | #28222c | #fffcf5 |
| --seg-track | #241f28 | #e4ddcb |
| --seg-thumb | #3b3542 | #fffcf5 |
| --grabber | #4a4450 | #c9c0ad |
| --faint | #857d8d | #6e6676 |
| --sep | #2c2731 | #e3dccb |
| --amber-ink | #ff8a3d | #a8440a |
| --amber-fill | #ff8a3d | #a8440a |
| --on-amber | #1a0d05 | #fff8f0 |
| --tint | rgba(255,138,61,.14) | rgba(201,82,15,.12) |
| --violet-tint | rgba(201,160,220,.15) | rgba(106,45,128,.1) |
| --brass-tint | rgba(176,141,87,.18) | rgba(138,107,58,.14) |
| --ok-tint | rgba(111,203,139,.15) | rgba(47,125,70,.12) |
| --bad-tint | rgba(240,133,123,.16) | rgba(184,50,42,.1) |
| --warn-tint | rgba(227,181,87,.16) | rgba(165,114,11,.12) |
| --dmd-ink | #ff8a3d | #ff8a3d |
| --dmd-dot | rgba(255,138,61,.13) | rgba(255,138,61,.13) |
| --bar | rgba(14,11,16,.82) | rgba(239,233,218,.84) |
| --scrim | rgba(5,3,6,.56) | rgba(28,23,32,.32) |
| --press | rgba(236,230,218,.07) | rgba(28,23,32,.06) |
| --wire-edge | inset 0 0 0 1px rgba(255,255,255,.2) | inset 0 0 0 1px rgba(0,0,0,.18) |
| --shadow-1 | 0 1px 0 rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35) | 0 1px 0 rgba(28,23,32,.08), 0 6px 18px rgba(28,23,32,.12) |
| --shadow-2 | 0 12px 40px rgba(0,0,0,.55) | 0 12px 36px rgba(28,23,32,.2) |
| --shadow-sheet | 0 -10px 40px rgba(0,0,0,.5) | 0 -8px 30px rgba(28,23,32,.16) |

- Link text uses `--amber-ink` (`a { color: var(--amber-ink) }`). Today links use `var(--amber)` in both themes (base.css:17-20), so the light-theme link colour #a8440a is new.
- Print (`@media print`, base.css:363) resets only `--shadow` today. It also needs `--amber-ink: #000`, `--shadow-1`, `--shadow-2` and `--shadow-sheet: none`, and `--raised`, `--cell`, `--sheet`, `--bar: #fff`.

### 1.2 Existing tokens (values unchanged; listed so this file stands alone)

| Token | Dark | Light |
|---|---|---|
| --ground | #0e0b10 | #efe9da |
| --surface | #1a161d | #f8f4ea |
| --sunk | #242028 | #e4ddcb |
| --ink | #ece6da | #1c1720 |
| --muted | #a79fae | #5e5766 |
| --line | #35303b | #d3cbb8 |
| --amber | #ff8a3d | #c9520f |
| --amber-glow | rgba(255,138,61,.45) | transparent |
| --violet | #c9a0dc | #6a2d80 |
| --brass | #b08d57 | #8a6b3a |
| --ok | #6fcb8b | #2f7d46 |
| --bad | #f0857b | #b8322a |
| --warn | #e3b557 | #a5720b |
| --dmd-well | #0a0709 | #17121a |
| --scan-filter | invert(.9) hue-rotate(180deg) | none |

### 1.3 Layout tokens (Components §07, MapFitSpec)

| Token | Value |
|---|---|
| --safe-top | env(safe-area-inset-top, 0px) |
| --safe-bot | env(safe-area-inset-bottom, 0px) |
| --topbar-h | 44 on phones, 50 on the tablet header, 56 on the desktop header |
| --tabbar-h | 49; 0 from 600 |
| --sheet-peek | 96 |
| --rail-w | 80 |
| --sidebar-w | 256 |
| --panel-w | 400; 420 from 1280 |

- The board writes the fallbacks as 47 and 34, its phone values. They ship as 0. Browsers that support `env()` define these insets (0 without a notch, and in Playwright), so the fallback only applies where the inset is undefined, and there a 47 / 34 inset would be wrong. The 47 and 34 stay the board's drawing values (the tables in §7.1).
- The breakpoints for 50 and 56 aren't stated. The drawings imply 50 for 600–1279 and 56 from 1280 **[confirm on board MapFitSpec]**.

### 1.4 Migrations (Components §07)

- `--shadow` → `--shadow-1`. Used today in `src/styles/base.css` and `src/components/QuickSearch.svelte`.
- `--r` → `--r-xs`. Used today in base.css, Base.astro, ManualSearch, MiniMap, PageViewer, PlayfieldMap, QuickSearch and SetupGuide.
- `--nav-h` retires in favour of `--topbar-h`: `src/styles/base.css:8` (scroll-padding-top) and `src/pages/handbook/[section].astro:130` (the reader's sticky `.side` top). Both add `var(--safe-top)`: `calc(var(--safe-top) + var(--topbar-h) + 12px)` and `calc(var(--safe-top) + var(--topbar-h) + 40px)`.
- `--on-amber` replaces the `#1a0d05` literal in `.btn.primary` (`src/styles/base.css:144`).
- The kit names `--top-h` / `--tab-h` ship as `--topbar-h` / `--tabbar-h`.
- `--gap` (12) and `--pad` (16) stay.

## 2. Type

Source: the kit and Components. Faces: Fell = IM Fell English SC (display), Plex Sans (UI), Plex Mono (codes).

| Class | Face | Size / line height | Notes |
|---|---|---|---|
| t-lt | Fell | 34/41 | letter-spacing .01em; large title |
| t-title | Fell | 22/28 | card name, sheet name |
| t-head | Plex Sans 600 | 17/22 | compact title, section heads |
| t-body | Plex Sans | 17/24 | kit base text |
| t-callout | Plex Sans | 16/21 | |
| t-sub | Plex Sans | 15/20 | subtitles, sidebar rows |
| t-foot | Plex Sans | 13/18 | kind lines, group headers |
| t-cap | Plex Sans | 12/16 | glass captions, rail labels |
| t-mono | Plex Mono 500 | 15/20 | tabular-nums |

- Other sizes the boards use:
  - Tab label 11/13, weight 500.
  - Desktop header h1: Fell 24/30.
  - Peek-sheet name: Fell 20/24.
  - Code chip: mono 14/18; large code chip: 22/26.
  - Buttons 17/22 weight 600; small buttons 15/20.
- The kit's base text is 17/24; the repo body is 16/1.5 today. **[confirm on board Components]**: owner question "Body 16 or 17".

## 3. Spacing

Source: the kit and Components §05.

- Page side padding: `max(16px, env(safe-area-inset-left))`, and the same on the right (Native).
- Grouped list:
  - Groups are inset 16 from the page edge.
  - Group header `.gh`: padding 22 32 7, 13/18. The big variant `.gh.big`: Fell 22/28, padding 26 20 8.
  - Group footer `.gf`: padding 7 32 0, --faint.
- List row:
  - Padding-left 16; 11 above and below the text; height 44 for one line, 60 for two.
  - The separator starts at the text, not the row edge.
- Card: padding 16, gap 14 (Components §06).
- Button grid in the map sheet: gap 8, margin 16 16 0 (MapExpanded).
- `--gap` 12, `--pad` 16 stay.

## 4. Radii and elevation

Source: Components §07 and the kit.

- Radii:
  - Tokens: --r-xs 6, --r-sm 10, --r-md 14, --r-lg 20.
  - Controls: buttons 12; small buttons 10; chips 16; pills 12; segmented track 9 and thumb 7; icon tiles 7 (list) or 9 (map layers list); toast 14; sheet top corners 20; grabber 3.
- Elevation:
  - `--shadow-1`: cards marked "lifted".
  - `--shadow-2`: toasts and glass.
  - `--shadow-sheet`: sheets.
  - Hairlines use `--sep`. The rail's is `inset -1px 0 0 var(--sep)`.
- Glass (`.glass`): background `--bar`, `backdrop-filter: blur(20px) saturate(1.5)`, `--shadow-2` plus an inset `--sep` ring. Used by the map controls, hint pills, the zoom readout and the keyboard legend.

## 5. Breakpoints

Source: Rationale §07 and MapFitSpec.

| Width | Navigation | Map selection | Top bar |
|---|---|---|---|
| < 600 | tab bar (49 + safe-bottom) | bottom sheet | 44 + safe-top |
| 600–999 | rail 80 | bottom sheet | 50 [confirm on board MapFitSpec] |
| 1000–1279 | rail 80 | side panel 400 | 50 |
| ≥ 1280 | sidebar 256 | side panel 420 | 56 |

- PlayfieldMap's `.stage` grid changes: today it is `minmax(0,3fr) minmax(320px,2fr)` from 900 (`src/components/PlayfieldMap.svelte:486-488`); it becomes `minmax(0,1fr) var(--panel-w)` from 1000 (Components §03).
- The board's phone-width query is `max-width: 599px`.

## 6. Shell

### 6.1 Tabs and mapping (Rationale §01–§04, Components §01)

The five tabs, in job order:

| Tab | Purpose | Replaces |
|---|---|---|
| Diagnose | The machine reports a fault. | Diagnose, header search |
| Map | Find the part on the playfield. | Map |
| Tables | Measure it with the meter in hand. | Switches, Lamps, Solenoids, Fuses |
| Handbook | Read how it works or how to fix it. | Handbook, Manuals, Parts |
| Workshop | Order the part and keep the machine. | Shopping list, Verify, Setup, Care |

- `nav` prop → tab (Base.astro gets these keys today): `diagnose` → Diagnose; `map` → Map; `switches`, `lamps`, `coils`, `fuses` → Tables; `handbook`, `manual`, `parts` → Handbook; `shopping`, `verify`, `setup`, `care` → Workshop.
- Reselecting the current tab pops to its root, scrolls to the top and focuses the h1.
- Tabs are never disabled.

### 6.2 Phone tab bar (Components §01)

- Size: 49 tall plus the 34 safe area, 83 in all. Five slots of 78.
- Icons: 26, stroke 1.75. Labels: 11/13, weight 500. Item padding-top 6, gap 3.
- Surface: `--bar` with blur 20 and saturate 1.5; a top hairline in `--sep`.
- Colours: idle `--faint`. The current tab is `--amber-ink` with a 6 px `--amber-glow` glow.
- Badge (Workshop):
  - An 18 px pill, mono 11, `--amber-fill` on `--on-amber`, with a 2 px ring in `--ground`.
  - Position: top 3, left `calc(50% + 5px)`.
  - The link's accessible name is "Workshop, 4 on the shopping list": the `aria-label` sits on the `<a>` and the badge is `aria-hidden`, as Components draws it. Map, MapPeek and MapFitSpec label only the badge span; Components wins.
  - Whether it hides at 0 isn't drawn **[confirm on board Components]**.

### 6.3 Rail, 600–1279 (ShellTablet, Components §01)

- 80 wide, padding-top 40, gap 4, `--surface`, right hairline.
- Items 80×64, label 12/16, idle `--muted`. The current item is weight 600 on a 56×32 pill (radius 16) in `--tint`.
- Badge: top 3, left `calc(50% + 7px)`, ring `0 0 0 2px var(--surface)`.
- Nav landmark: `nav aria-label="Sections"`.

### 6.4 Sidebar, from 1280 (ShellDesktop)

- 256 wide, padding 18 16 16, `--surface`, right hairline.
- "Skip to content" is the first focusable element.
- Top: the logo image 160×81 (margin 0 0 12 8), then a search field "Find a part or a handbook page" (`.search`, 15/20, margin-bottom 12). Whether that field is QuickSearch is open.
- Rows:
  - Top-level rows: 44 tall, padding 0 12, radius 10, gap 12, icon 22, 15/20 weight 500, `--ink`. Groups are 8 apart.
  - The current row: `--tint`, `--amber-ink`, weight 600.
  - Sub-rows: 36 tall, padding-left 46, radius 8, 15/20, `--muted`.
- Sub-rows per tab:
  - Tables: Switch matrix, Lamp matrix, Solenoids & flashers, Fuses, LEDs & jumpers.
  - Handbook: Handbook, Manuals, Parts.
  - Workshop: Shopping list (count pill), Verify, Care, Machine setup, Device data.
- Shopping count pill: mono 12, 20 tall, radius 10, `--tint` / `--amber-ink`, followed by the sr-only text " parts to order". It's plain text inside the link: no `role=status` and no `<output>`, because the sidebar renders on every page (§12).
- The Device data sub-row follows Q7 (its own page, a section on `/workshop`, or `/shopping` as today).

### 6.5 Top bar (Components §02)

- Phone:
  - The safe area (47) sits above a 44 nav row (`.tb`: a 3-column grid, padding 0 8).
  - Title centred, max 220 wide.
- Tab roots add a large-title row:
  - The row is 52 tall (`.lt`: padding 0 16 5), Fell 34/41.
  - The compact title is Plex 600 17/22.
  - The hairline shows only when collapsed.
- Collapse is linked to scroll over the first 52 px:
  - The large title slides under and fades.
  - The compact title fades in between 40 and 52.
  - The hairline appears at 52.
  - Under reduced motion the titles swap at 52 with no slide.
- Pushed pages get the compact bar only. The Map tab also gets the compact bar only.
- Back link (`.back`):
  - A chevron (26) plus the parent's title, 17/22, `--amber-ink`.
  - 44 tall, padding 0 8 0 2.
  - A real `<a href>` to the parent.
- Icon button (`.ibtn`): 44×44, radius 22, glyph 24. Text link (`.tlink`): 44 tall, 17/22, 8 side padding.
- Markup: a `<header>`. Every page has exactly one h1 (appendix.spec.ts:16 runs a strict level-1 heading query), so the bar's title is the h1 only where the page has none of its own:
  - Tab roots (`/`, `/tables`, `/handbook`, `/workshop`): the large title is the h1; the compact title is `aria-hidden`; the in-page h1 goes.
  - Pages with their own h1 today (`grep -rln '<h1' src/pages`): the bar's title is `aria-hidden` and not a heading.
  - Pages with no h1 today (ComponentPage, the manual viewer) and `/map`: the compact title is the h1.
- Tablet header (ShellTablet): 50 tall, a bottom hairline, `.tb-title` (e.g. "Map"), trailing ibtns.
- Desktop header (ShellDesktop): 56 tall, padding 0 8 0 24, h1 Fell 24/30 (e.g. "Playfield map"), trailing ibtns.
- Map's trailing ibtns: "Find a part" at every width (Map, ShellTablet, ShellDesktop); "All parts on the map" on phones only (Map), since from 1000 the side panel holds the list.
- What moves where:
  - QuickSearch moves into Diagnose.
  - `#theme-toggle` (Base.astro:75-77, its script :100-115, and the print rule base.css:384) moves into Workshop → Appearance.
  - ComponentPage's `<div class="crumbs small muted">` (`src/layouts/ComponentPage.astro:40`) becomes the back link.
  - `scroll-padding-top` (base.css:8) becomes `calc(var(--safe-top) + var(--topbar-h) + 12px)`.
  - The footer (Base.astro:92-99) stays on every page but `/map`; its paragraph also goes into Workshop → About this handbook. `#sw-status` (:98) leaves it (§8.8).
- Hover styles sit inside `@media (hover: hover)`, so a tap never leaves a hover tint (base.css:21, :139, :214 today).

### 6.6 Side panel (ShellTablet, ShellDesktop)

- `aside aria-label="Selected part and parts on the map"`, 400 wide (tablet; 420 from 1280), `--surface`, left hairline.
- On the tablet it sits at left 780, top 24, 796 tall.
- Contents: see §7.7.

## 7. Map

Source: MapFitSpec, unless noted.

### 7.1 Fit rule

- `s = min(stageW / 1246, stageH / 2702)`. `playfield.png` is 1246×2702.
- The drawing is centred horizontally and top-aligned.
- `stageH = 100dvh − topbar (44 / 50 / 56) − tabbar (49 on phones, 0 from 600) − safe-top − safe-bot`.
- `stageW` = the viewport width minus the rail or sidebar and the side panel, where present.

| Viewport | Stage W×H | Drawing | Offset | Selection |
|---|---|---|---|---|
| Phone 390×844 | 390 × 670 (844−44−49−47−34) | 309 × 670 (s 0.24797) | gutters 40.5 | bottom sheet |
| Tablet portrait 820×1180 | 740 × 1086 (rail 80; 1180−50−24−20) | 501 × 1086 | left 119.6 | bottom sheet |
| Tablet landscape 1180×820 | 700 × 726 (rail 80 + panel 400) | 334.8 × 726 (the MapFitSpec caption rounds to 335) | left 182.6 | side panel |
| Desktop 1440×900 | 764 × 844 (sidebar 256 + panel 420; 900−56) | 389.2 × 844 (s 0.31236) | left 187.4 | side panel |

- The phone stage starts at y 91 (47 + 44), is 390×670, has overflow hidden and a `--ground` background (Map).
- The bug this fixes: a 358×776 canvas sits inside a 658-tall scroller (`max-height: 78vh`, PlayfieldMap.svelte:493), so 118 px is cut off and the card sits below the fold.
- In Playwright, env() safe areas are 0. Tests assert the rule, not the board numbers.
- In code the top part of the rule is measured, not summed: `stageH = 100dvh − stageTop − tabbar − safe-bot`, where `stageTop` is the scroller's document top. Before Phase 5 the old header and, from 1000 in calibration, the docked card sit above the stage, and the fixed topbar sum would overflow.
- `/map` is full bleed: no `.wrap` padding or max-width (base.css:81-85) and no footer (Base.astro:92-99). The page itself never scrolls at any width: `document.documentElement.scrollHeight ≤ innerHeight + 1`. The parts list lives in the side panel from 1000 (capped at the stage height, scrolling inside) and in the "All parts on the map" sheet below 1000; nothing sits under the stage.
- Code proposal (MapFitSpec):

```text
.scroller{height:calc(100dvh - var(--stage-top) - var(--tabbar-h) - var(--safe-bot)); overflow:hidden; touch-action:pan-x pan-y}
--stage-top = scroller.getBoundingClientRect().top + scrollY, re-measured on resize (header, calibration card, viewport)
.scroller.zoomed{overflow:auto}
.canvas{position:relative; margin-inline:auto}   .canvas img{width:100%; height:100%}
phone = MediaQuery('max-width: 599px'); ZOOMS = [1, 1.6, 2.4]
inset = phone && current && zoom === 1 ? 96 : 0
fit = Math.min(w / 1246, (h - inset) / 2702)      // w, h from a ResizeObserver on the scroller
canvas style: width = 1246*fit*zoom px, height = 2702*fit*zoom px
fitAll = () => { zoom = 1; centre(); }
pinch: zoom = clamp(z0 * dist / dist0, 1, 3) around the midpoint
centre(): scrollTop aims at l.y * scroller.scrollHeight - (scroller.clientHeight - inset) / 2
dragMove keeps working
```

### 7.2 Zoom and pan

- Steps: 1, 1.6, 2.4. Pinch covers 1–3.
- Sizes on the phone: 1.6× = 494.4×1072; 2.4× = 741.5×1608; 3× = 926.9×2010.
- Sizes on the desktop: 1.6× = 622.7×1350.4; 2.4× = 934.1×2025.6; 3× = 1167.6×2532.
- Pan is clamped. At 1× there is nothing to pan.
- Double-tap steps up at the tap point. The zoom buttons centre on the selected part, or on the stage centre when nothing is selected.
- Fit returns any zoom to 1×, centred.
- Keys: `+` / `−` zoom, `0` fits, the arrows pan the focused stage, Esc deselects.
  - The handler sits on the map component's root, never on `window`, so the handbook embed ignores keys typed elsewhere on the reader. `+` `−` `0` and Esc act with focus anywhere inside the component; the arrows need the stage itself (`tabindex=0`).
  - On `/map` only, a `window` listener also takes them while focus is on `body`, never from an input or textarea.
- At 1× the scroller is `overflow: hidden`, so any pan at 1× (the expanded sheet, §7.6) is a `transform: translateY()` on the canvas. Above 1× the scroller scrolls.
- MapZoom (2.4×, Switches layer only):
  - Switch markers are 26 px with id labels. The drawing is 741.5×1608 at left −20, top −276.
  - A hint pill reads "Pinch, or tap Fit to see the whole playfield": `.glass.t-cap`, top-centre 12 from the top, 32 tall, radius 16, padding 0 16.
  - A "2.4×" readout shows. Fit is enabled (amber).

### 7.3 Controls, phone (Map, MapPeek)

- A right-hand column 44 wide, 10 from the right edge, gap 8, z-index 25. It sits in the part of the drawing with no parts (x ≥ 0.925 has none).
- The column's bottom is 12 above the tab bar: page y 433–749 at rest, 337–653 while the peek sheet is up. It hides when the sheet is expanded (120 ms fade).
- Layers capsule:
  - `.glass`, `role=group aria-label="Layers"`, 44×176, radius 14.
  - Four `aria-pressed` buttons: Switches, Lamps, "Solenoids and flashers", Shots. By default the first three are on and Shots is off.
- Zoom capsule:
  - `.glass`, `role=group aria-label="Zoom"`, 44×132.
  - Buttons: "Zoom in", "Zoom out", "Fit whole playfield".
  - Fit is `aria-disabled="true"` in `--faint` at 1× and `--amber-ink` when zoomed.
- Faults pill:
  - `button.glass.t-cap`, text "4 faults on the map", `aria-label="Show faults, 4"`.
  - Bottom-left of the stage: left 12. The Map board draws it at top 632 (bottom 658, about 103 above the stage bottom, level with the control column's lower capsule), not 12 above the stage bottom; Q27 confirms the position with its action. 26 tall, radius 13, gap 6, padding 0 10.
  - What it does isn't drawn **[confirm on board Map]**.
- Top bar: title "Map" with two ibtns, "Find a part" and "All parts on the map". Until the Phase 5 top bar exists, "All parts on the map" is an interim 44×44 `.glass` ibtn at the top of the right column.
- "All parts on the map" opens a sheet on phones; on wide screens it is the panel's list.
  - The phone sheet is a modal BottomSheet (§8.2; detent not drawn) holding today's aside content, so nothing sits under the stage: a "Find a part" field that filters rows by id or name (Q28), the layer-source link (Q25), the provenance paragraph (`.prov`, PlayfieldMap.svelte:384-388), then the rows per visible layer. Picking a row closes the sheet and selects the part.
  - What the "Find a part" ibtn does isn't drawn **[confirm on board Map]**. The proposal (Q28): it opens the same list with that field focused.
- The fixed `#sw-status` line (§8.8) sits above the control column and passes pointer events through, except on its Reload button.

### 7.4 Controls, wide (ShellTablet, ShellDesktop)

- Layers list:
  - `.glass` at left 16, top 16, **164 wide**, radius 14.
  - Rows 44 tall, padding 0 12 0 6, gap 10.
  - Each row has a 32×32 icon tile (radius 9) tinted `--tint` / `--violet-tint` / `--brass-tint`, untinted when off.
  - Label `.t-sub`: Switches / Lamps / Solenoids / Shots. Count `.mono.t-foot.muted`: 55 / 60 / 33 / 17.
  - `aria-label` e.g. "Switches, 55 on the map". An off row is `--muted`.
  - The list is `role=group aria-label="Layers"` made of `aria-pressed` `<button>`s, like the phone capsule. smoke.spec.ts:85-90 runs at 1440×900 (desktop-light) and clicks `group 'Layers' → button 'Switches'`, which matches "Switches, 55 on the map". Only one of the two layer controls is rendered at a time, or the strict locator finds two groups.
  - Take the counts from the data, not the board.
- Zoom capsule at right 16, bottom 16.
- Zoom readout: `.glass.mono.t-cap` at right 68, bottom 68, 28 tall, radius 14; an sr-only "Zoom level" precedes "1×". The boards give it `role=status`; that's allowed because it renders on `/map` only (§12).
- The layer-source link (Q25) sits at the top of the aside, not under the stage.
- The aside column is capped at the stage height and scrolls inside (`overflow: auto`), so the list never lengthens the page.
- Keyboard legend (ShellDesktop):
  - `.glass.t-cap`, `role=note`, `aria-label="Keyboard shortcuts"`, at left 16, bottom 16, padding 10 12, radius 12.
  - Keycaps: mono, 20 px, radius 5, `--sunk`.
  - Entries: "+ − zoom", "0 fit", "Arrows pan", "Esc deselect".
  - Shown at 1440; the width where it starts isn't stated **[confirm on board ShellDesktop]**.
- Whether the layers list or the capsule is used at 600–999 isn't drawn **[confirm on board ShellTablet]**.

### 7.5 Markers (MapFitSpec, Map, MapZoom, kit)

- Size at 1×: switch 12, lamp 10, coil 13, shot 16. The selected marker is 24 and shows its id. Ids appear on the other markers from 1.6×.
  - The shot's 16 isn't drawn on any board (it's the generator's default) **[confirm, Q5]**.
  - Today the sizes are a % of the canvas width (`MARKER`, PlayfieldMap.svelte:38, :344); they become fixed px.
- Sizes stay constant in px through the peek re-fit.
- Above 1× no formula is given; MapZoom draws switches at 26 at 2.4× **[confirm on board MapZoom]**.
- Every marker has a 44 hit area. Where hit areas overlap, the nearest centre wins. One mechanism does both:
  - Each marker `<button>` is only its visible size. No enlarged box, `::before` or wrapper, so a marker never covers another marker's centre (Playwright clicks a marker at its centre, smoke.spec.ts:15-18, :80-83).
  - One `pointerup` handler on the canvas takes taps that land on no marker and selects the nearest visible marker whose centre is within 22 screen px.
  - A drag (moved > 6 px) or a pinch never selects. Calibration drags still start on the marker button (`dragStart`, :349).
- Styles:
  - sw: fill rgba(255,138,61,.22) with a 1.5 px amber inset ring.
  - lamp: `--violet-tint` fill, violet ring.
  - coil: radius 28%, `--brass-tint` fill, brass ring.
  - shot: `--raised` fill, ink ring, body font 600.
  - Fault: a 2 px `--bad` ring on a `--bad-tint` fill.
  - Dimmed: opacity .4.
  - Selected: `--amber-fill` with `--on-amber` text and a shadow of `0 0 0 3px var(--ground), 0 0 18px var(--amber-glow)`.
- Pulse:
  - A ring of the selected size + 8 (32).
  - 1.6 s, standard ease, scale 1→2.2, opacity .9→0, **once**. Today it loops (`PlayfieldMap.svelte:608`); owner question.
  - None under reduced motion.
- Names:
  - "Switch 32, Upper Right Jet", "Lamp L13, …", "Solenoid 7, …", "Shot K, …".
  - A faulted marker adds ", Fault". The selected one adds ", selected" and `aria-pressed="true"`.
  - Today's names are "32 Upper Right Jet" (PlayfieldMap.svelte:346). `tests/e2e/smoke.spec.ts:16,:81` match on them. The list rows share that name today (:400-408), and `.first()` picks the marker because the canvas comes first in the DOM; keep that order.

### 7.6 Phone selection sheet (MapPeek, MapExpanded, Components §03)

- Peek (96):
  - `section aria-label="Selected part, Switch 32"` (a section, not a dialog). It sits at bottom 83 (above the tab bar), 96 tall, z-index 28.
  - Surface: `--sheet`, radius 20 20 0 0, `--shadow-sheet`.
  - Grabber: a `button.grabber` labelled "Expand details" / "Collapse details" with `aria-expanded`. It is 36×5 (radius 3) with an 88×24 hit area, margin 6 auto 0. A tap toggles it.
  - Header row: 56 tall, margin-top 9, padding 0 16, gap 10. It holds:
    - `.code.lg.dmd` "32".
    - An h2 in Fell 20/24, "Upper Right Jet".
    - `.t-foot.muted` "Switch · column 3, row 2".
    - `.pill.fault` "Fault".
    - A Deselect ibtn (`--muted`) wrapping a 30 px `--sunk` circle.
- The re-fit when peek opens at 1×:
  - The drawing fits to stageH − 96: 264.7×574 at left 62.65.
  - Switch 32 moves from (130.6, 241.3) to (139.8, 206.8).
  - The control column moves from y 433 to 337.
  - Above 1× the map never rescales; it only pans.
  - Deselect re-fits.
- Expanded (416):
  - The sheet's top is at 345 of 844. There is no rescale: the drawing pans to top −79.8, so the part sits mid-band in the 254 px left uncovered. The controls hide.
  - At 1× that pan is a `transform: translateY(-79.8px)` on the canvas (the scroller can't scroll at 1×); collapsing returns it to 0. Above 1× the scroller scrolls instead. 300 emphasized; a jump under reduced motion.
  - Content:
    - `.gh` "Wiring". Rows: Green-Orange, Column 3, J206-3 · U20-16; White-Red, Row 2, J208-2 · U18-9.
    - The hint "Owner's hint" with its text.
    - `nav aria-label="More about switch 32"`: a 2-column grid (gap 8, margin 16 16 0) of `.btn.gray.sm` buttons, 44 tall: "Details", "Manual p. 2-39", "Switch matrix", "On the shopping list".
  - The phone sheet has no status control, only the pill.
  - MapFitSpec's schematic shows other link labels (Switch matrix / Handbook / Test report / Add to list). MapExpanded wins **[confirm on board MapExpanded]**.
- Tablet portrait (600–999) also uses a bottom sheet. The code proposal applies the 96 inset only below 600 **[confirm on board MapFitSpec]**.

### 7.7 Wide side panel (ShellTablet, ShellDesktop)

- Selected-part section: 530 tall, padding 0 16.
  - Header (56): "Switch 32" and a Deselect ibtn.
  - `.code.lg.dmd`; the name in `.t-title`; the kind line in `.t-foot`.
  - `.seg.status` (margin-top 16): OK / Fault / Not tested, each with a dot.
  - A Wiring group on `--raised`, then the hint.
  - A group of link rows (margin-top 16, on `--raised`): Details; Manual `p. 2-39`; Switch matrix; On the shopping list `SW-11A-37` (with the ok icon).
  - A 32 px fade at the bottom.
- With nothing selected, the selected-part section shows today's empty card (PlayfieldMap.svelte:381-389): the h2 "Playfield", "Tap a marker on the drawing, or pick from the list." and the `.prov` provenance paragraph. The boards don't draw this state.
- List section (flex 1, top hairline):
  - Header `.t-head` "Switches" with "55 on the map", padding 16 32 8.
  - `.row.two` rows: a mono id tile, the name, and "Column 3, row 1".
  - The selected row is on `--tint`, its tile `--amber-fill`, and it shows `.pill.fault`. It also carries `aria-current="true"`, the only `aria-current` in the list, so the selection isn't colour alone.
  - The "Find a part" filter field heads the list if Q28 confirms the proposal.

### 7.8 Calibration (`?calib=1`)

- The map keeps its fit.
- On wide screens the card docks under the top bar, above the stage. On phones it is a sheet at the medium detent that does **not** re-fit the map. The detent's height isn't given (the modal medium is ≈470) **[confirm on board MapFitSpec]**.
- The card:
  - An overlay select.
  - Opacity 0.1–0.9, step 0.05, starting at 0.5.
  - Nudge by 0.001, or 0.005 with Shift.
  - "Copy JSON (n moved)" and "Discard drafts", both disabled until something has moved.
- Unchanged: drafts in localStorage `taf.positions.draft` and overlays from `src/data/overlays.json`.

### 7.9 Handbook embed

- The embed is `<PlayfieldMap client:visible layer="shot" />` in `src/pages/handbook/[section].astro:74`, inside `#pg-9 .shot-map`.
- It must keep its 17 shot markers (smoke :94-98).
- Its stage height isn't drawn **[confirm on board MapFitSpec]**. Until then it fits to the container width with the height capped at the page stage height, so it is never cropped.
- An `embed` prop turns off the page-level behaviour, which today leaks into the reader:
  - no `syncUrl()` (PlayfieldMap.svelte:137-143 calls `history.replaceState`, so a tap in the embed rewrites the reader's URL to `?layer=…&id=…`);
  - no selection sheet, parts sheet or side panel: the selected card and the list stay under the drawing, as today;
  - keys only on its own root (§7.2).

## 8. Components

### 8.1 States (Components)

- Pressed: a `--press` fill; bare text dims to 55%; 120 ms.
- Focus-visible: a 2 px `--amber` ring, offset 2. In list rows it is inset (−2).
- Disabled: `--faint` text on a `--sunk` fill, with `aria-disabled`.
- Selected: amber on `--tint`.

### 8.2 Bottom sheet (Components §03, Motion)

| Detent | Height | Use |
|---|---|---|
| Peek | 96 (`--sheet-peek`) | map selection |
| Expanded | 416 (top at 345 of 844) | map selection |
| Modal medium | ≈470, over `--scrim` | Install (≈470 on the Install board) |
| Modal large | top at 57; the parent recedes | Show on map (SwitchMapSheet, per Motion) |

- The detents for Go to page, Add to shopping list, All parts on the map and the phone calibration sheet aren't stated **[confirm on boards ManualViewer, SwitchShop, Map, MapFitSpec]**.

- Surface: `--sheet` with `--r-lg` top corners; rows use `--sheet-cell`; `--shadow-sheet`. Bottom padding 34 (`.sheet`).
- Head (`.sheet-head`): 52 tall, 3 columns. Title (`.sheet-title`): 17/22, weight 600.
- The parent recedes to scale .94, moves down 10 and dims to .62. (The kit's `.recede` uses .92; the board wins.)
- Map kind: a `section`. The grabber is a button with `aria-expanded`; a tap toggles it; a drag tracks the finger.
- Modal kind:
  - `role=dialog aria-modal="true"`, focus trapped, and focus returns to the opener on close.
  - The page behind is `inert`.
  - It closes with Close, Esc, a tap on the scrim, or a drag. A drag is never the only way.
- Timings: rise to peek 300 (emphasized, with the map re-fit); modal present 420 (emphasized); dismiss 300 (exit).

### 8.3 Segmented control (Components §04)

- Track: 36 tall, radius 9, inset 2, gap 2, `--seg-track`.
- Thumb: 32 tall, radius 7, `--seg-thumb`, shadow `0 1px 3px rgba(0,0,0,.28), 0 0 0 .5px rgba(0,0,0,.18)`. It slides in 200 ms (standard).
- Labels: 15/20 weight 500; the chosen one 600.
- Status variant:
  - OK chosen: `--ok-tint` with a 1 px `--ok` ring.
  - Fault chosen: `--bad-tint` with a `--bad` ring.
  - Not tested: the neutral thumb.
  - It keeps `role=group aria-label="Test status"` and `aria-pressed`. Pressing the chosen value again clears it.
- Tabs variant: switches.astro gets `role=tablist` "Switch matrix view" with Matrix / Dedicated J205 / Flipper J806, using `aria-selected`, `aria-controls` and the arrow keys.
- Links variant: Handbook / Manuals / Parts are links with `aria-current`.
- Appearance variant: System / Dark / Light (Workshop).

### 8.4 List row and groups (Components §05, kit)

- Height: 44 for one line, 60 for two. Padding-left 16.
- Icon tile: 30, radius 7, glyph 19, on `--tint`.
- Text: the title 17/22 `--ink`; the subtitle 15/20 `--muted`; the value 17/22 or mono 15/20 `--muted`; the chevron 14 `--faint`.
- Separator: 1 px `--sep` starting at the text.
- Group: inset 16, radius 14, `--cell`. Header 13/18 with 22 above and 7 below; footer `.gf`.
- Markup: rows sit in a `<ul>`, each an `<a>` or a `<button>`.
- Toggle (`.toggle`):
  - 51×31 with a 27 knob in #f4efe6; amber when on.
  - `role=switch`, named for example "Done: Free Play".
- Destructive rows: `--bad`, no chevron. "Clear all" then asks "Really clear all?" (features.spec:85-87).
- Swipe action:
  - 88 wide, it reveals "Fixed" in `--ok`.
  - The button "Fixed: {name}" stays (shopping.spec:25).

### 8.5 Card (Components §06)

- Box: radius 14 (`--r-md`), padding 16, gap 14, `--cell` with an inset `--sep` hairline. The lifted variant adds `--shadow-1`. 342 wide on a phone.
- Anatomy, in order:
  1. The code chip: `.code.lg`, 40 tall, mono 22, DMD.
  2. The name (Fell 22/28) and the kind line (15/20).
  3. Wiring: wire chips 26×10, pins in mono 12, `--wire-edge`.
  4. A mini-map: 310×120, radius 12, `--sunk`.
  5. The status segmented control.
  6. Actions as `.btn.sm` (36 tall, radius 10, `--tint`): Show on map / p. 2-39 / Details.
  7. The hint: `--brass-tint`, radius 12, keeping the text "(owner's experience, not the manual)".
- Used by Diagnose.svelte, ComponentPage.astro and PlayfieldMap (the wide panel; MapExpanded governs the phone sheet).

### 8.6 Chips, pills, codes, wires (kit)

- `.chip`: 32 tall, padding 0 12, radius 16, `--sunk`. `.chip.on`: `--tint` with an inset `--amber-ink` ring. The hit area is still 44.
- `.pill`: 24 tall, radius 12, 13/18 weight 600, in ok / fault / untested variants. `.dot`: 8 px.
- `.code`: 26 tall, min-width 36, radius 6, 14/18, letter-spacing .06em, uppercase. `.code.lg`: 40 tall, min-width 54, radius 8, 22/26.
- `.dmd`: a dot grid (a radial gradient on a 4 px background-size) on `--dmd-well`, text in `--dmd-ink`, text-shadow `0 0 10px rgba(255,138,61,.5)`, inset rings. The DMD well stays dark in the light theme.
- `.wire i`: 26×10, radius 5.
  - Colours: Brown #7B4B2A, Red #C62828, Orange #EF7D1A, Yellow #F2C230, Green #2E8B3D, Blue #2458C6, Violet #7B3FB0, Gray #8C8C8C, Black #1A1A1A, White #F7F7F7.
  - A striped wire is base 0–58%, stripe 58–76%, base 76–100%.
- `.hint`: padding 12 14, radius 12, `--brass-tint`, 15/21; its bold label is 13/18 in brass.

### 8.7 Buttons and fields (kit)

- `.btn`: 50 tall, padding 0 20, radius 12, 17/22 weight 600, svg 20. Variants: primary (its text is `--on-amber`, §1.4), tinted, gray (`--sunk`), plain.
- `.btn.sm`: 36 tall, padding 0 14, radius 10, 15/20. Wherever it stands alone it must still offer a 44 hit area.
- `.search`: 36 tall, radius 10, `--seg-track`, placeholder in `--faint`.

### 8.8 Toast (Native, Update, Motion)

- `.toast`: left and right 12, min-height 56, padding 10 10 10 14, radius 14, `--raised`, `--shadow-2` plus an inset `--sep` ring.
- It sits 10 above the tab bar. One toast at a time; Update ready wins.
- Offline ready: "Ready to work offline. Scans are cached as you open them." It leaves after 4 s.
- Update ready: "A new version of the handbook is ready." with "Reload". It leaves only on Reload.
- Motion: 200 ms standard with a 12 px rise. Under reduced motion it only fades.
- Semantics: the host is a `div` with `aria-live="polite"` and `aria-atomic="true"`, never `role=status` or `<output>`. It renders on every page, and `/care`, `/setup` and `/shopping` run a strict `getByRole('status')` (§12).
- The host has `pointer-events: none`; only the toast's buttons take pointer events, so it never blocks the tab bar or the map controls.
- Until the toast lands (Phase 11), `#sw-status` (Base.astro:98) leaves the footer and becomes a fixed line at the same place, with the same pointer rule; pwa.ts hides the offline-ready text after 4 s.

## 9. Screens

### 9.1 Diagnose home (Main, MainLight; Rationale §03)

- Large title "Diagnose". Intro: "Type what the machine shows: a test report, a Check Switch message or single codes."
- The top bar has one ibtn, "Recent reports". What it opens isn't drawn (Q16).
- Quick links at the top: Playfield map, Switch matrix, Lamp matrix. Tiles 72 tall, radius 14, `--surface`, label `.t-sub` weight 600 (Main styles).
- Today's other home links (index.astro:15-40) move to the hubs the boards draw for them: Test menu and Error messages → `/handbook`; Fuses → `/tables`; Verify, Setup and Care → `/workshop`; the map layer links → the Map tab. Each stays on `/` until its hub row exists.
- Recent:
  - "Check Switch 68 – 1 switch · 1 marked Fault – Yesterday".
  - "L13 L15 – 2 lamps · both marked Fault – 23 Sep".
  - "SOL 7 – 1 solenoid – 12 Sep".
  - Recording isn't drawn. Because diagnosis is live, an entry is recorded on "Diagnose", on Enter, or when the field loses focus with at least one recognised code; the same normalised input moves to the top (Q16).
- On first run, examples show instead of Recent: "32 68 F1 F3", "Check Switch 32", "L11 L12 L13", "SOL 7".
- The field is the hero, docked low:
  - Label "Test report or display message". "32 68 F1 F3" is the **placeholder**: the board draws it at opacity .45 after the caret, so the field is empty (today's placeholder, Diagnose.svelte:47).
  - Buttons "Paste" and "Diagnose". Diagnosis stays live on input (Diagnose.svelte:19-31; the tests never press a button). "Diagnose" records the entry in Recent and moves focus to the results.
  - Below it: "Or type a word to search everything."
- The DMD field (Main styles): `.dmd` radius 14, padding 18, min-height 112; text 26/32, weight 500, letter-spacing .06em.

### 9.2 Results (DiagnoseResults, DiagnoseResultsLight)

- Bar: "Clear", "4 codes", "Share results".
- Code chips 32 68 F1 F3 with a "1 of 4" counter.
- Shared-cause card: "J806 Shared connector — F1 and F3 both go to connector J806 on the Fliptronics board. More", with "Appendix A6, Flippers".
- Result cards (§8.5). The second is "68 Vault — Switch · matrix column 6, row 8".
- A floating input "Test report or display message" with a "Diagnose" button.
- What the tests read stays: `.cards article` as `article.comp[data-id]` with the name in an `h2`; `.prov` "Not recognised"; the `.causes` card with "Shared cause?" and its `matrix` link (the task file, Keep → Diagnose).

### 9.3 Search (DiagnoseSearch)

- Bar: "Search", "Clear search", "Cancel".
- The trigger isn't drawn beyond "type a word". Exactly: the field is in search when its input is one line, has **no digit**, and has at least 2 letters. Anything else is a live diagnosis, so "row 5" still says "Not recognised" (features.spec.ts:22-27) and "Check Switch 32" still diagnoses.
- Chips: All / Components / Handbook / Manuals / Parts.
- Components 20:
  - F1 Right Flipper End of Stroke Switch; F2 Right Flipper Button Switch; F3 Left Flipper End of Stroke Switch.
  - LLF Lower Left Flipper, Flipper coil FL-15411.
  - F101 Lower Left Flipper, Fuse · 3A S.B.
  - Then "Show all 20 components".
- Handbook: A6 Flippers (Owner service notes); Flippers (Handbook · p. 2).
- Parts: flipper ring-red 23-6519-4; flipper w/shaft yellow 20-9250-6.

### 9.4 Map screens

See §7: Map, MapLight, MapPeek, MapPeekLight, MapExpanded, MapZoom, ShellTablet, ShellDesktop.

### 9.5 Tables hub (Tables)

- Large title "Tables", with a search field "Search tables".
- Recently viewed: 32 Upper Right Jet Switch; 68 Vault Switch; L13 Jackpot (2) Lamp.
- Matrices: Switch matrix "64 matrix, 8 dedicated, 8 flipper"; Lamp matrix "64 lamps".
- Drivers: Solenoids & flashers 28; Flipper coils 4; General illumination 5 strings.
- Boards: Fuses 25; Diagnostic LEDs 10; Jumper charts.
- Take the counts from `src/data`. Where the data and the board differ, the data wins; note it.

### 9.6 Switch matrix (SwitchMatrix, SwitchMatrixLight)

- Pushed from "Tables"; title "Switch matrix"; a Search ibtn.
- Tablist "Switch matrix view": Matrix / Dedicated J205 / Flipper J806.
- Grid "Switch matrix, 8 columns by 8 rows":
  - Column headers: Green-Brown, Green-Red, Green-Orange, Green-Yellow, Green-Black, Green-Blue, Green-Violet, Green-Gray.
  - Row headers: White-Brown, White-Red, White-Orange, White-Yellow, White-Green, White-Blue, White-Violet, White-Gray.
- Unused cells: 11, 12, 23, 28, 46, 52, 83, 88.
- Selecting a cell shows a card: 32 Upper Right Jet with its wiring, and the buttons "Open" and "Show on map".

### 9.7 Component detail (Switch)

- Back link "Results" (shown opened from Diagnose). Title "Upper Right Jet / Switch 32". A "More" button.
- Header: 32, "Matrix column 3, row 2", "Not tested". Then the status segmented control and a Note.
- Wiring.
- Parts: Switch SW-11A-37 with "Add to list"; Assembly B-12030-2.
- Location: "Show on map", "Callout 32 on p. 2-39". Then the hint.
- "On the same jet bumper": Upper Right Jet, Lamp · bulb #555, L22; Upper Right Jet, Solenoid · Low Power, SOL 10.
- Service log: 12 Sep OK.
- Footer: "Status, notes and the log stay on this device."
- Today's ComponentPage prev/next pager (ComponentPage.astro:68-80) isn't drawn **[confirm on board Switch]**.
- What stays (the tests read it): the `.notes` block "Service notes" with its appendix links (ComponentPage.astro:44-65; appendix.spec.ts:7-12, :21-22); the "Service log" list, found by label (features.spec.ts:29-39); and exactly one visible button containing "Fault" plus one named "OK" (smoke.spec.ts:61-66; features.spec.ts:31-32, :43-45). SwitchShop's "Just mark Fault" may exist only while its sheet is open.
- The page has no h1 today; the compact top-bar title becomes its h1 (§6.5).

### 9.8 Show on map (SwitchMapSheet)

- A modal sheet at the large detent: "Upper Right Jet / Switch 32" with Close.
- A cropped map showing the neighbours 31, 33, 34, 44a/b and 61, with switch markers at 46 px.
- "Callout 32 on p. 2-39".
- Buttons: "Open in Map" (→ `/map?layer=sw&id=32`) and "Manual page".

### 9.9 Add to shopping list (SwitchShop)

- A modal sheet with Cancel. Title "Add to shopping list".
- Body: "Switch 32 is marked Fault. Order the part now or later."
- Part to order: "Blade switch SW-11A-37" or "Whole assembly B-12030-2".
- Quantity: "Decrease quantity", 1, "Increase quantity".
- Buttons: "Add to shopping list" and "Just mark Fault".
- Note: "The list groups parts by part number, so a second Fault on the same switch type adds to this line."
- The quantity and the part choice change the data model: the list is derived from Fault status today (`src/lib/shopping.ts` groupFaults). Owner question.

### 9.10 Handbook home (HandbookHome)

- Segmented links: Handbook / Manuals / Parts. A search field "Search the handbook and scans".
- Continue reading: "Test menu p. 1-15".
- Operations Manual, operator's section:
  - Quick reference & contents.
  - Rules & shot maps A–F.
  - Assembly & operation 1-1–1-6.
  - Menu system & bookkeeping 1-7–1-14.
  - Test menu 1-15–1-19.
  - Utilities.
  - Difficulty & presets 1-22–1-26.
  - Adjustments A.1–A.5 1-28–1-43.
  - Error messages & codes 1-44–1-45.
  - LEDs, fuses & maintenance 1-46–1-48.
- Note: "Pages 1-16 to 1-18 are transcribed from a poor scan and not yet verified."
- Owner service notes A1–A8: Multimeter basics; Coils, magnets and motors; Switches and optos; Lamps, flashers and GI; Power driver board; Flippers; Connectors and cleaning; Shopping out the playfield.
- Footer: "The owner's own notes, not manual text."

### 9.11 Reader (HandbookReader)

- Back link "Handbook". Title "Test menu p. 1-15". A "View the scan" action.
- Bottom toolbar: "1-14" (previous), "Contents", "Text size", "1-16" (next).

### 9.12 Manual viewer (ManualViewer)

- Back link "Manuals". Title "Operations Manual p. 2-39". A "Text" button (smoke:49 clicks "Text").
- Toolbar: "Previous page", "97 / 124" (opens Go to page), "Next page", "Rotate page".
- Go to page sheet: "Done", a Page field, "Go".
- Document segmented control: Operations / Handbook / Schematics.
- Contents: Unique parts 2-33 … Ramps 2-43.
- Footer: "Scans are saved on the device as you open them."
- Not drawn, but it stays (the task file, Keep → Manual viewer):
  - Zoom: "Zoom out", "Fit", "Zoom in" (PageViewer.svelte:138-140) move into a `.glass` capsule, `role=group aria-label="Zoom"`, 44 px buttons, floating bottom-right over the scan above the toolbar, like the Map's (§7.3) **[confirm on board ManualViewer]**. "Rotate page" replaces today's Rotate (:141).
  - Pinch, Ctrl + wheel, drag to pan, and the keys ← → `+` `−` `0` `R` `T`. The key hint (:196) shows from 1000 or under `(hover: hover)`.
  - ManualSearch ("Search manual text", OCR full text) on this page (`manual/[doc]/[page].astro:40`) and on `/manual` (manual/index.astro:13).

### 9.13 Parts (Parts)

- The segmented links, then "Search parts" and "Clear search".
- "52 rows". Note: "Descriptions are OCR from the original and may have small errors."
- Columns: Item / Part no. / Description / Qty. Keep the `<table>`; smoke:58 reads `tbody tr`.

### 9.14 Workshop hub (Workshop)

- Rows: Shopping list 4; Verify "5 of 13"; Care "Next: every week or so"; Machine setup "7 steps".
- This device:
  - Appearance: a segmented control named "Toggle theme" with System / Dark / Light.
  - Device data: "Back up status, notes and setup". It links to Device data's current home (`/shopping`, where features.spec opens it) until Q7 settles.
  - Offline: "Ready".
  - Install app. Hidden until Phase 11 (the install sheet, §9.16).
- About: Version 0.1.0; About this handbook.
  - The Version comes from package.json.
  - "About this handbook" opens a modal sheet holding the site footer's copyright paragraph word for word (Base.astro:93-97) and the Version. Its contents aren't drawn.
- Footer: "Everything you record stays in this browser. Back it up before switching phones."
- Count sources: Shopping list from the status store (`groupFaults`); Verify from the `tafh:verify` ticks, read through a new `src/lib/verify-store.ts` (verify-check.ts:5-15 keeps the key and loader private and runs `initVerifyChecks()` on import, :54, so the hub can't import it); Machine setup from `setupItems()` (src/lib/model/setup.svelte.ts:55).
- No count on the hub uses `role=status` or `<output>` (§12).

### 9.15 Shopping list (Shopping)

- Back link "Workshop". A "Copy as text" icon. Title "Shopping list". "4 parts to order".
- Switches:
  - "1 × SW-11A-37 B-12030-2 · 32 Upper Right Jet".
  - "1 × 5647-12693-08 A-15070 · 68 Vault".
- Bulbs:
  - "1 × #555 24-8768 · L13 Jackpot (2)".
  - "1 × #44 24-6549 · L15 Stars".
- Each row has "Fixed". One row shows the swipe reveal.
- Buttons: "Copy as text" and "Share".
- Footer: "Mark a part Fault and it lands here. Fixed clears the fault."
- Where the repo wins over the board (the tests and the text export depend on it; the task file, Keep → Shopping list):
  - The lamp group is titled **Lamps**, not "Bulbs" (`KIND_TITLE`, src/lib/shopping.ts:26-30).
  - Each group is a `section.grp` with an `<h2>`.
  - The item link text is `{itemRef} {name}`: "S32 Upper Right Jet", "L13 Jackpot (2)", "C01 Chair Kickout" (shopping.ts:31-33).
  - Each row keeps its "Fixed: {name}" button, so the swipe is never the only way.
  - The empty state stays "Nothing marked Fault yet"; "Show text" and its textarea stay; the export text is unchanged.
  - The "Service kit" section (shopping.astro:50-96) stays below the list, restyled as a group.

### 9.16 Install (Install)

- A modal medium sheet, ≈470 tall: "Install the handbook" with Close.
- Body: "Adds it to your home screen. It opens full screen, like an app, and works offline in the workshop."
- Checklist: "Opens without the browser bar" / "Works with no signal" / "Updates itself when you are online".
- Button "Install".
- Footer: "On iPhone: tap Share, then Add to Home Screen."

### 9.17 Update (Update)

The Tables screen with the Update toast (§8.8) above the tab bar.

## 10. Motion

Source: Motion.

| Token | ms | Used for | Reduced motion |
|---|---|---|---|
| --dur-1 | 120 | press, tab icon, fading the map controls | kept, without the icon scale |
| --dur-2 | 200 | tab cross-fade, toast in | kept; the toast drops its rise |
| --dur-3 | 300 | pop, dismiss, scrim, Fit, sheet to peek | 150 ms cross-fade |
| --dur-4 | 350 | push, sheet detent snap | 150 ms cross-fade |
| --dur-5 | 420 | modal present | fades in at its detent, 150 ms |

- Untokened durations:
  - 150: the reduced-motion fallback.
  - 250: zoom steps, double-tap, rubber band and the swipe-back spring.
  - 1.6 s: the pulse, run once.
  - 4 s: the toast dwell. The update toast stays until acted on.
  - 1.06 s: the DMD caret blink, in hard steps; steady under reduced motion.
- Curves: standard `cubic-bezier(.2,0,0,1)`; emphasized `cubic-bezier(.32,.72,0,1)`; exit `cubic-bezier(.3,0,1,1)`. The rule: "Lands = emphasized, leaves = exit, fades = standard."
- Push: the incoming view goes 100% → 0 and the outgoing one 0 → −30% under a 10% shade, both 350 emphasized. The title fades into the back button.
- Pop: 300 exit.
- Swipe back:
  - It starts at the left edge and tracks the finger.
  - A release past 35% of the width, or faster than 500 px/s, commits (300 exit). Otherwise it springs back (250 emphasized).
  - The edge width isn't given **[confirm on board Motion]**.
- Modal:
  - Present: the scrim goes 0→1 over 300 (standard); the sheet goes from y 100% to its detent over 420 (emphasized); the parent scales 1→.94 over 420.
  - Dismiss reverses all three over 300 (exit).
- Map sheet:
  - It rises to peek over 300 (emphasized); a drag tracks the finger; it snaps to 96 or 416 over 350 (emphasized).
  - On expand the drawing moves y 0 → −79.8 over 350 (emphasized), with the snap. At 1× it is a `translateY` on the canvas, because the scroller is `overflow: hidden` there (§7.6); collapse returns it to 0 with the snap. The control column fades out over 120 (standard).
  - Under reduced motion the snap becomes the 150 ms fade and the drawing jumps inside it. The drag still follows the finger; the control-column fade stays.
- Select at 1× re-fits together: the sheet, the drawing (309×670 → 264.7×574) and the controls (y 433 → 337), all over 300 emphasized. Deselect reverses over 300 exit.
- Fit: any zoom to 1× centred, 300 emphasized. Buttons and double-tap: 250 emphasized. Pinch covers 1–3 and rubber-bands over 250.
- Tab switch:
  - A 200 standard cross-fade; the icon scales 1 → .9 → 1 over 120.
  - Each tab keeps its stack, every view's scroll offset, and the Map's zoom and selection.
- Large title: linked to scroll; unchanged under reduced motion (it swaps at 52).
- Under reduced motion:
  - Select jumps under a 150 ms cross-fade.
  - Pinch stops at 1× and 3× with no rubber band. There is no pulse.
  - Sheets appear at their detent with a 150 fade, and the parent doesn't scale.
  - The control-column fade and the tab cross-fade stay. The tab icon doesn't scale.
- Kit rule: `@media (prefers-reduced-motion: reduce) { .caret, .pulse { animation: none } }`.
- Toasts (§8.8, same numbers everywhere): in over 200 standard with a 12 px rise; the offline toast leaves after 4 s; the update toast stays until Reload. Under reduced motion it only fades. The interim fixed `#sw-status` line (Phases 1–10) uses the same 4 s.

## 11. Native and PWA

Source: Native, Install, Update.

| Setting | Value | Today |
|---|---|---|
| display | standalone | in place (astro.config.ts) |
| short_name | TAF Handbook | in place |
| background_color / theme_color | #0e0b10 | in place |
| meta theme-color | #0e0b10 dark, #efe9da light | in place (Base.astro:46-47) |
| apple-mobile-web-app-status-bar-style | black-translucent | add |
| apple-mobile-web-app-title | TAF Handbook | add |
| viewport | viewport-fit=cover | in place (Base.astro:43) |
| env(safe-area-inset-*) | top 47, bottom 34 on 390×844 (device values, not fallbacks: the tokens fall back to 0, §1.3) | add |
| orientation | any | add |
| start_url / scope | follow BASE_PATH | in place (astro.config.ts:9, :30-31); keep |
| apple-touch-icon | icons/icon-180.png | change (today icon-192.png, Base.astro:49) |
| maskable icon | icons/maskable-512.png | change (today icon-512.png doubles as it, astro.config.ts:38) |

- Icons:
  - 180 (60 pt @3×) with radius 40; 120 with radius 27; 60 with radius 13.
  - The radii are iOS's mask, not part of the files. `icon-180.png` is an opaque square, #0e0b10 to the edges, no transparency and no rounded corners (iOS rounds them itself; transparent corners turn black).
  - The maskable icon is a padded copy with the art inside the centre 80%. `pnpm icons` runs `scripts/icons.mjs`.
- Splash:
  - Background #0e0b10 in both themes. The icon is 120 pt, centred. The name is in IM Fell English SC 22 pt, 16 pt below it.
  - This phone needs `apple-touch-startup-image` at exactly 1170×2532, linked with `media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"`. iOS ignores a startup image whose media query doesn't match; other iPhones get no splash.
  - The name is drawn as outlines in the source SVG (converted once from `public/fonts/im-fell-english-sc-latin-400-normal.woff2`): sharp renders SVG text with the machine's installed fonts, not the web font.
- Safe-area CSS (through the §1.3 tokens, fallback 0):
  - `.topbar{padding-top:var(--safe-top)}`
  - `.tabbar{padding-bottom:var(--safe-bot)}`
  - `.page{padding-left:max(16px,env(safe-area-inset-left)); padding-right:max(16px,env(safe-area-inset-right))}`
- Warning: black-translucent keeps the status-bar clock white on the light theme. Test on an iPhone before release.
- System states:
  - Offline ready and Update ready are toasts (§8.8).
  - Scan not cached: inline, "This scan isn't on the device yet. Open it once while you have a connection.", with a "Show the text" button.
  - Install: a sheet (§9.16).
  - Cache: `tafh-scans` is the runtime cache for `/assets/pages/`, 600 entries for one year (astro.config.ts:57-58, in place). HTML, JS, CSS and data are precached.
- Touch:
  - 44 hit areas in both directions (a 32 px chip is fine visually).
  - Swipe back on every pushed view.
  - Pull-to-refresh on Workshop only. It checks for an update and ends in the Update toast or in "The handbook is up to date." for 4 s.
  - No hover-only affordances. Long-press is never the only way.
- Theme:
  - Workshop → Appearance offers System / Dark / Light.
  - The board says: "Dark is the default and the first frame. On System the handbook turns light when the phone does; Dark or Light pins it. The choice stays on this device in tafh:theme, and System clears it."
  - Today no stored key means the app follows the OS (tokens.css `prefers-color-scheme` block). "Dark is the default" and "System clears it" can't both hold. Owner question.

## 12. Accessibility

Source: Rationale §08, Components and MapFitSpec.

- The contract that stays (Rationale §08):
  - "Skip to content" → `#main`.
  - `aria-current` on navigation.
  - A 2 px amber focus ring, offset 2.
  - Light amber text is #a8440a. It is new: nothing in `src` uses it today. It lands as `--amber-ink` in tokens.css (Phase 1; §1.1), and links and amber text use it (base.css:17-20 today uses `--amber`).
  - The matrix's arrow keys and Enter; the e2e matrix test is "contract, not polish".
- Headings: exactly one `<h1>` per page. appendix.spec.ts:16 reads `getByRole('heading', { level: 1 })` strictly, so a bar title and a large title can't both be h1. Base's `h1` prop picks which one is: `'large'`, `'page'` (the page's own h1; the bar title is a `div`) or `'bar'` (the manual viewer). In-page h1s go where the large title takes over (Phase 5).
- `role=status` and `<output>` stay only where they are today: SetupGuide.svelte:30, DeviceData.svelte:94, ShoppingList.svelte:52. `/care`, `/setup` and `/shopping` run a strict `page.getByRole('status')` (care.spec.ts:6-19; setup.spec.ts:7-26, :68-70; features.spec.ts:75), so nothing rendered on every page (the shell, the tab badge, the toast host, the Workshop hub's counts) uses them. The map's zoom readout may, because it renders only on `/map`.
- Landmarks:
  - `nav aria-label="Sections"` (tab bar, rail, sidebar).
  - `<header>` for the top bar; the large title is the h1.
  - `main#main`.
  - The panel `aside`.
- Targets: 44 minimum everywhere, including chips. Markers keep their visible size as buttons; their 44 hit area is the canvas rule in §7.5 (nearest centre within 22 px; a drag over 6 px never selects).
- Hover: no hover-only affordances. Hover styles sit inside `@media (hover: hover)` so a tap doesn't leave them stuck: today's `a:hover` (base.css:21), `.btn:hover` (:139) and `table.t tbody tr:hover` (:214) move there (Phase 5).
- Names:
  - The badge link: "Workshop, N on the shopping list".
  - Markers: §7.5.
  - Layers buttons use `aria-pressed`, in a `role=group` named "Layers"; wide rows are e.g. "Switches, 55 on the map". Only one layer control renders at a time.
  - The selected row in the parts list has `aria-current="true"`.
  - Fit uses `aria-disabled` at 1×.
  - The zoom readout has the sr-only "Zoom level".
  - The keyboard legend is `role=note`.
- Sheets and segmented controls: §8.2 and §8.3.
- Rows and toggles: §8.4.
- Contrast in the light theme (text on `--ground`): `--ok` 4.19, `--warn` 3.46 and `--brass` 4.08 are under 4.5. Owner question.
- Motion: §10. Every gesture has a button: swipe back has the back link; the swipe to Fixed has the button; a sheet drag has the grabber button and Close.
