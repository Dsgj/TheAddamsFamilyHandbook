# Data schema

Every file in `data/`, `content/` and `assets/`, field by field. All of it was produced from the owner's three manuals and the factory parts list in `source/`. Page numbers below are **PDF page numbers of `source/Operations_Manual_1992.pdf`** unless written as a manual label such as `1-15` or `2-39`.

Mapping PDF page → printed label for the Operations Manual:

| PDF pages | Printed label | Content |
|---|---|---|
| 1 | cover | |
| 2 | (none) | jumper charts + solenoid/flasher table |
| 3–4 | (none) | table of contents |
| 5–10 | A–F | rules, Thing Flips calibration, mansion awards, shot maps |
| 11–58 | 1-1 … 1-48 | Section 1: operation & test |
| 59–102 | 2-1 … 2-44 | Section 2: parts |
| 103–123 | 3-1 … 3-21 | Section 3: wiring & schematics |
| 124 | (none) | warnings |

Formula: label `1-n` = PDF `n+10`, `2-n` = `n+58`, `3-n` = `n+102`.

Operator's Handbook (`source/Operators_Handbook_1991.pdf`, 12 pages): PDF page `n` = printed page `n-1` (cover is unnumbered). WPC Schematic Manual: 14 sheets, sheet 1 is the cover.

---

## `data/components.json`

One object with these keys.

### `switches[]` (80 entries: 64 matrix positions incl. unused, 8 dedicated `D1–D8`, 8 flipper `F1–F8`)

| Field | Type | Meaning | Source |
|---|---|---|---|
| `id` | `"11"…"88"`, `"D1"…"D8"`, `"F1"…"F8"` | Switch number as the game displays it. Matrix id = column×10 + row. | 2-39, 3-4, handbook p9 |
| `name` | string | Name as printed (e.g. `Upper Right Jet`). `"Not Used"` for empty positions. | 2-39 |
| `part` | string | Switch part number (e.g. `SW-11A-37`, `5647-12693-19`); empty if not printed | 2-39 |
| `assy` | string | Assembly the switch sits in (e.g. `B-12030-2`) | 2-39 |
| `col`, `row` | 1–8 or `null` | Matrix position; `null` for dedicated/flipper switches | |
| `colWire`, `colWireEn` | string | Column wire colour, Swedish / English (e.g. `Grön-orange` / `Green-Orange`) | 3-4 |
| `colPin` | string | CPU board connector pin for the column (e.g. `J206-3`) | 3-4 |
| `colIc` | string | CPU board IC pin driving the column (e.g. `U20-16`) | 3-4 |
| `rowWire`, `rowWireEn`, `rowPin`, `rowIc` | string | Same for the row (e.g. `Vit-röd`, `J208-2`, `U18-9`) | 3-4 |
| `wire`, `wireEn`, `pin`, `kind` | string | **Dedicated/flipper switches only**: single wire colour, connector pin, and `kind: "ded"|"flip"`. Flipper pins are on the Fliptronics board (`J806-x` EOS, `J805-x` buttons); dedicated pins on the CPU board (`J205-x`). | handbook p9 |
| `under` | bool | Printed with † = located on the underside of the playfield | 2-39 |
| `notShown` | bool | Printed with * = not shown on the diagram (cabinet/coin door) | 2-39 |
| `unused` | bool | `"Not Used"` | |
| `hint` | string (Swedish) | **Not from the manual.** A short per-switch-type service hint written by the assistant (jets, slingshots, optos, rollovers, EOS…). Show as "erfarenhet". EOS hint contains the manual's gap spec (0.062″ ± 0.015″) which *is* from 2-16. | experience |
| `loc[]` | `{x, y, l}` | Marker positions on `assets/maps/sw.png`, **normalised 0–1 to that image's width/height**. `l` is the printed callout label (may be `44a`/`44b` for the two Cousin It targets). Empty for switches not on the diagram. | 2-39 diagram |

Column/row header data: `swCols` and `swRows` — objects keyed `"1"…"8"` → `[wireSv, wireEn, connectorPin, icPin]`.

### `lamps[]` (64 entries)

| Field | Meaning | Source |
|---|---|---|
| `id` | `"11"…"88"` (column×10 + row) | 3-2 |
| `name` | as printed (e.g. `G-R-E-E-D "E"-1`) | 2-40 |
| `bulbPart` | `24-8768` (#555) or `24-6549` (#44) | 2-40 |
| `bulb` | `"#555"` or `"#44"` | 2-40 |
| `assy` | lamp socket assembly (e.g. `A-15110` = 10-lamp PCB) | 2-40 |
| `col`, `row` | 1–8 | |
| `colWire/En`, `colPin`, `colQ` | column wire (yellow-x), Power Driver connector `J137-x`/`J138-9`, column drive transistor `Q91–Q98` | 3-2 |
| `rowWire/En`, `rowPin`, `rowQ` | row wire (red-x), `J133-x`, row drive transistor `Q83–Q90` | 3-2 |
| `speaker` | bool: lamps 81–87 sit in the speaker panel | 2-40 |
| `unused` | bool (41 and 76) | |
| `loc[]` | as for switches, relative to `assets/maps/lamp.png` | 2-40 diagram |

Headers: `lCols`, `lRows` → `[wireSv, wireEn, connectorPin, transistor]`.

### `coils[]` (28 entries: solenoids 01–28 incl. flashers)

| Field | Meaning | Source |
|---|---|---|
| `id` | `"01"…"28"` | 3-6 / p2 |
| `name` | function as printed | 3-6 |
| `type` | `High Power` / `Low Power` / `Flasher` (the *circuit* type — 25–28 are motors/coils on flasher-type drivers) | 3-6 |
| `wire`, `wireEn` | wire colour Swedish / English abbreviation as printed (`Brn-Grn`) | 3-6 |
| `pin` | Power Driver connector pin(s), e.g. `J127-6` or `J126-3 / J125-3` for flashers | 3-6 |
| `driver` | drive transistor on the Power Driver board (`Q50`) | 3-6 |
| `part` | coil or lamp type (`AE-26-1200`, `#906`, `20-9247 12V`) | 3-6 |
| `assy` | mechanism assembly (`A-9415-2`) — empty when 2-41 prints none | 2-41 |
| `fuse` | **Derived** by the assistant from the fuse list (1-47): 01–08 → F105, 09–16 → F104, 17–24 → F111, 25–28 → F103. Mark as derived. | 1-47 |
| `under` / `cabinet` | printed † (underside) / ¶ (in cabinet) | 2-41 |
| `note` | flasher number (`Flasher #3 (2)`) or the magnet-fuse footnote | 2-41 / 3-6 |
| `loc[]` | relative to `assets/maps/coil.png`; labels `19a/19b`, `20a/20b`, `21a/21b`, `22a` appear for multi-lamp flasher circuits | 2-41 diagram |

### `gi[]` (5), `flippers[]` (4), `fuses[]` (25), `leds[]` (10)

- `gi`: `id` (`GI 1`…`GI 5`), `name`, `wire` (Swedish), `pin` (`J120-1`…), `driver` (triac `Q10–Q18`), `bulb`, `fuse` (from 1-47).
- `flippers`: `id` (`ULF/URF/LLF/LRF`), `name`, `wire`, `pin` (`J109-x`), `coil` (`FL-11753`, `FL-11630`, `FL-15411`), `assy` (`A-15205-…`), `fuse` (F101/F102 lower, F901/F902 upper).
- `fuses`: `id` (`F101`…, `—` for unnumbered), `board` (Swedish), `circuit`, `rating` (`3A S.B.`; S.B. = slow blow, N.B. = normal blow). Includes the line-filter fuses (domestic 8A N.B. / foreign 4A S.B.) and the 5A S.B. magnet fuse under the playfield.
- `leds`: CPU D19–D21 and Power Driver LED 1–7, `what`, `normal` (Swedish).

### `maps`

`{ sw: {w, h, page}, lamp: {...}, coil: {...} }` — pixel size of each map image in `assets/maps/` and the PDF page it was cropped from (97, 98, 99). `loc` coordinates are normalised to these images.

---

## `data/callouts-page-relative.json`

The same callout positions **before cropping**, keyed by PDF page (`"97"`, `"98"`, `"99"`), normalised to the full page. `snap: true` means the position was snapped to a detected black disc in the scan (d = distance in px at 300 dpi from the hand-placed seed); `snap: false` means hand-placed only (lamp 13 and 71). Kept for re-deriving `loc` if the maps are re-cropped. The crop boxes used were (fractions of page width/height, left/top/right/bottom): sw `(.514,.085,.969,.824)`, lamp `(.408,.070,.847,.839)`, coil `(.502,.124,.961,.845)`.

---

## `data/parts.json`

Array of rows from `source/Parts_List.txt` (the factory indented bill of materials), each:

```
[item:number, level:number, partNo:string, description:string, used:string, parentIndex:number|null]
```

`level` 1 = top level of the machine; `parentIndex` is the array index of the enclosing assembly (follow it up to build the "sits in" path). `used` is the quantity **within its parent** (multiply up the chain for totals). Descriptions are the factory's abbreviations (`flpr stop brkt`).

---

## `data/ocr-text.json`

`{ ops: string[124], hb: string[12], wpc: string[14] }` — cleaned OCR text per page (index 0 = page 1), for full-text search of pages that are not transcribed. Noisy; the transcribed pages in `content/handbook/` supersede it (the prototype replaces `ops[n-1]` with the transcription's plain text at load).

## `data/pages.json`

`{ ops: [[page, widthPx, heightPx, tiled]…], hb: [...], wpc: [...] }` — dimensions of the images in `assets/pages/`. `tiled: true` (WPC sheets 2–14) means the sheet is stored as four quadrant tiles `N_00.png N_01.png N_10.png N_11.png` (row, column) plus an overview `N_o.png` at 25 %; `widthPx/heightPx` is the full sheet.

---

## `assets/`

- `assets/pages/ops/N.png` (N = 1…124; page 1 is `1.jpg`, the colour cover), `assets/pages/hb/N.png` (1…12), `assets/pages/wpc/1.png` + tiles. All greyscale PNGs quantised to 4 levels (2-bit), 180 dpi for ops/hb, 150 dpi for wpc.
- `assets/maps/{sw,lamp,coil}.png` — the three location diagrams, cropped at 250 dpi.
- `assets/figures/ops9.png, ops10.png` (shot maps A–S), `ops12.png` (leg leveler/pitch), `ops14.png` (coin door buttons), `ops17.png` (menu tree — superseded by the HTML menu map in `ops017.md`, kept for reference), `ops56a.png` (CPU board LEDs), `ops56b.png` (Power Driver LEDs/fuses), `ops57.png` (fuse locations, all boards).

In dark theme the prototype inverts scans with `filter: invert(.9) hue-rotate(180deg)`; do the same or better.

---

## `content/handbook/opsNNN.md`

One Markdown file per transcribed Operations Manual page (PDF pages 2, 3, 5–10, 11–58 → `ops002.md` … `ops058.md`; 56 files). Conventions:

- First line: `<!-- page N | label 1-15 -->` (label omitted when the page has none).
- `##` = a main heading on that page; `###` = an item (`### A.1 20 Custom Message`, `### T.4 Solenoid Test`, `### B.1 01 Total Earnings`). Adjustment headings follow the pattern `### A.<group> <NN> <Name>` — parse these to build the adjustments catalogue. Test items: `### T.<n> <Name>`. Utilities: `### U.<n> <Name>` and `U.9 NN` presets.
- Every list of choices/settings is a GFM table, usually `| Choice | Meaning |`, sometimes with `| Range | … |` / `| Settings | … |` rows, or wide preset tables. Difficulty/preset tables (pages 32–36) and the pricing table (50) are complete.
- Figures: `![caption](fig/ops12.png)` — paths are relative to the prototype; map them to `assets/figures/`. Remaining un-cropped figures appear as `*[Figure: caption]*`.
- Internal links: `[1-15](#goto:ops:25)` = open PDF page 25 of the Operations Manual (used on the TOC page). `[…](#find:T.4)` = jump to the heading that starts with `T.4 ` (used in the menu map on `ops017.md`, which contains raw HTML: `<div class="mmap">…` and `<div class="mkeys">…` — restyle freely).
- Pages 9 and 10 contain only the shot-map figures; page 5 is the rules cover.
- Original spelling and typos are kept on purpose (`Single Switchs`, `more then one`, `Jumper Bumper`). Do not "fix" them.

Section grouping used by the prototype (`tools/build_reader.py` → `SECTIONS`):

| Key | Swedish title | Pages |
|---|---|---|
| snabb | Snabbreferens och innehåll | 2, 3 |
| regler | Regler och shot maps | 5–10 |
| drift | Montering och drift | 11–16 |
| bokforing | Menysystemet och bokföring | 17–24 |
| test | Testmenyn | 25–29 |
| utilities | Utilities | 30, 31, 37 |
| presets | Svårighetsgrad och presets | 32–36 |
| justeringar | Justeringar A.1–A.5 | 38–53 |
| fel | Felmeddelanden och felkoder | 54, 55 |
| led | LED, säkringar och underhåll | 56–58 |

---

## `prototype/`

`index.html` is the assembled single-file prototype (data inlined, asset paths pointing at `../assets/`). `index.src.html` is its source with `/*DATA*/`-style placeholders; `tools/assemble.py` fills them. Serve the kit root with any static server and open `/prototype/index.html`.

## `tools/`

Python 3 + Pillow + OpenCV + pytesseract, and poppler's `pdftoppm`/`pdftotext`:

- `pack.py` — renders PDF pages to the 4-level PNGs (and tiles the WPC sheets).
- `detect2.py`, `approx.py`, `match.py` — detect the numbered callout discs on pages 97–99 and snap hand-placed seeds to them → `callouts-page-relative.json`.
- `build_data.py` — builds `components.json` from hand-verified tables + callouts.
- `build_reader.py` — Markdown → sectioned HTML + TOC + plain text (`reader.html`, `reader.json`).
- `assemble.py` — inlines data into `index.src.html`.

They are reference implementations of the pipeline, not runtime code.
