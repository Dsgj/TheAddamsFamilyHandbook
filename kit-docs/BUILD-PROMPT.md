# Build brief: service app for a Bally *The Addams Family* pinball machine (1992, WPC)

You are building a small, beautiful, long-lived web app that helps the owner of **one specific** Bally/Williams *The Addams Family* pinball machine (WPC, Fliptronics I, model 20017) keep it running. The owner is a senior full-stack engineer who will read the code. The app lives on a phone under a raised playfield as often as on a desktop, so it must work offline, one-handed, and in bad light.

Everything you need is in this kit. **Read the kit before writing code**, in this order:

1. `README.md` (what is in the kit)
2. `docs/DATA-SCHEMA.md` (every data file, field by field)
3. `docs/KNOWLEDGE.md` (domain knowledge: symptom guides, settings, LED/ROM/service notes — this is app content)
4. `docs/MACHINE.md` (facts about this particular machine; seed for the service log)
5. `docs/KNOWN-ISSUES.md` (data caveats you must carry into the UI as provenance notes)
6. `prototype/index.html` (the working prototype you are replacing; run it with any static server from the kit root to see the intended flows)

Do not invent data. Every component number, wire color, connector, transistor, fuse and part number comes from `data/` or `content/`, which were transcribed from the owner's own manuals. Where the kit says a value is uncertain, say so in the UI.

---

## 1. Mission and users

**Mission:** when something is wrong with the machine, the owner opens the app, tells it what the display says or what he sees, and is guided to the component, its location, its wiring, the exact test in the game's built-in test menu, and the fix — and what he did is remembered.

**Users:**
- The owner (technical, reads schematics, owns a multimeter and a soldering iron).
- Colleagues at the office where the machine stands (non-technical; they play, report faults, and may start a guided service session or read the log).

**Language:** UI in **Swedish**. Manual content stays in its original **English** (it is a transcription; do not translate it). Domain terms that Swedish pinball people use in English stay in English (flipper, jet bumper, slingshot, EOS, GI, opto, insert, trough, multiball, attract mode).

---

## 2. Non-negotiables

1. **Local-first and offline.** Everything the app shows must be available with no network after the first visit, including the full handbook text, all component data, the three playfield maps and the figures. Page scans of the manuals may load lazily but must be downloadable for offline use with one tap ("Ladda ner allt").
2. **Data is the owner's.** Every record the app creates (service log, settings snapshot, shopping list, photos) is exportable as plain JSON + files with one tap, and importable. Sync to a server is optional and never required.
3. **Provenance.** Everything sourced from the manual links to the original page image (`assets/pages/...`). Knowledge that comes from `docs/KNOWLEDGE.md` rather than the manual is marked as such ("erfarenhet, inte manualen").
4. **Phone at the machine.** Core flows (guided service, component lookup, map, log entry) must be completable one-handed on a 390 px wide phone with 44 px targets, in a "Verkstadsläge" (workshop mode) with larger type and higher contrast, screen kept awake while active.
5. **Theme-aware and accessible.** Dark theme first (the machine's world is a mansion at night), a full light theme, `prefers-color-scheme` respected, WCAG AA contrast, keyboard-navigable matrices and maps, `prefers-reduced-motion` respected.
6. **No infringing artwork.** See §7.

---

## 3. Tech stack (decided — do not relitigate)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 5 + TypeScript**, static output | The app is 80 % content (a transcribed manual, tables, images) and 20 % interactive tools. Astro's content collections turn `content/handbook/*.md` into typed, static pages with zero JS by default; interactive parts are islands. |
| Islands | **Svelte 5** (runes) | Small, fast, readable components for the map, matrices, guided service wizard, log forms and search. No React: nothing here needs its ecosystem or bundle. |
| Styling | **Hand-written CSS** with design tokens (custom properties), container queries, one `tokens.css` and one `base.css`; component styles scoped in Svelte/Astro | The theme is bespoke. No Tailwind or component library — they pull toward a generic look. |
| Local data | **Dexie** (IndexedDB) | Local-first records with indexes; survives offline; simple. |
| Sync (optional) | **PocketBase** adapter | One Go binary with SQLite, auth, file storage and realtime. Runs as one Docker container next to the static site on the owner's home server. The app must run fully without it; when a PocketBase URL is configured, records sync (last-writer-wins on `updatedAt`, tombstones for deletes, ULID ids). |
| Search | **MiniSearch**, index prebuilt at build time for handbook + components + parts; log entries indexed at runtime | Small, no server, fuzzy + prefix. |
| PWA | **@vite-pwa/astro** (Workbox) | Precache app shell, data, maps, figures, fonts. Runtime cache page scans (cache-first, size-capped) plus an explicit "download all scans" action. |
| Images | Keep the kit's 4-level grayscale PNGs (crisp line art). Generate a 50 % thumbnail set for lists. | Already optimized; PNG beats JPEG/AVIF for 1-bit scans. |
| Fonts | Self-hosted (in `public/fonts`), see §7 | Offline. |
| Tests | **Vitest** (data model, sync merge, code parsing) + **Playwright** (core flows, offline mode, both themes, 390 px) | |
| Tooling | pnpm, ESLint, Prettier, TypeScript strict | |
| Data pipeline | Existing **Python** scripts in `tools/` (pdf → png, callout detection, markdown → html) kept as-is under `tools/`, documented, not part of the runtime | Python is right for image/PDF munging; nothing else in the app needs it. |
| Deploy | GitHub Actions → GitHub Pages; and a `Dockerfile` (nginx:alpine serving `dist/`) + `docker-compose.yml` with optional `pocketbase` service. **Base path must be configurable** (`BASE_PATH` env → Astro `base`), because the owner's home server only allows sub-paths, not subdomains. | |

Why not Rust or a full backend: the app is content and small records. A Go binary we do not have to write (PocketBase) covers auth, files and sync. Why not SvelteKit: Astro's content collections are the better fit for a Markdown manual with dozens of tables; SvelteKit would have us re-invent that.

---

## 4. Architecture

```
src/
  content/handbook/          ← the kit's content/handbook/*.md (Astro content collection)
  data/                      ← the kit's data/*.json, imported at build time; also copied to public/data for runtime
  lib/
    model/                   ← types + Dexie schema + repositories (log, status, settings, shopping, machine, photos)
    sync/                    ← StorageAdapter interface; LocalAdapter; PocketBaseAdapter
    search/                  ← index build (node script) + runtime query
    codes.ts                 ← parse test-report input ("32 68 F1 F3", "Check Switch 32", "L55", "C07", "Q50", wire colours)
    guides/                  ← symptom guides as typed data (from KNOWLEDGE.md), not prose in components
  components/                ← Svelte islands (PlayfieldMap, Matrix, ServiceWizard, LogEditor, SettingsTable, ShoppingList, Search, PageViewer)
  layouts/, pages/
public/
  assets/{maps,figures,pages} ← from the kit
  fonts/
tools/                       ← Python pipeline from the kit
```

- **Static pages** for: handbook sections, each component (`/switch/32`, `/lamp/55`, `/coil/13`), each adjustment (`/adjust/A.1-20`), each guide, the fuse/LED/matrix references, the printable coin-door card.
- **Islands** for anything stateful.
- **One `StorageAdapter`** interface (`get/put/delete/list/subscribe/exportAll/importAll`). The app never talks to Dexie or PocketBase directly.
- **Routing:** clean URLs; every component, adjustment, page scan and log entry is linkable.

---

## 5. Features

Preserve everything the prototype does (parity list in §5.0), then add P0–P2. Ship in the milestone order in §9.

### 5.0 Parity with the prototype (must not regress)

- **Felsök**: type test-report codes → cards per component with mini-map crop, wiring (column/row wire colours with colour chips, connector pins, IC pins / driver transistor), part numbers, test steps, per-component status (OK / Fel / Ej testad) and note. Shared-cause analysis: switches in the same column/row/connector are called out.
- **Spelplan**: three location diagrams (switches, lamps, solenoids/flashers) with markers at manual callout positions, zoom, click → details; status colours on markers.
- **Switch matrix, lamp matrix** (8×8 with wire colours, connectors, ICs/transistors), dedicated + flipper switches, solenoid table, GI table, flipper coil table, fuse list, LED list, CPU/sound error codes, jumper charts.
- **Handbok**: transcribed manual in themed sections with page markers linking to scans, clickable main-menu map, TOC with search.
- **Manualer**: page viewer for all three documents (text mode where transcribed, image mode otherwise), zoom, rotate, keyboard nav, full-text search across OCR + transcription.
- **Reservdelar**: 2 562-row parts list with the assembly path of each part.

### 5.1 P0 — "Starta service" (guided service session) — the centrepiece

A wizard that turns "the display says X" into a completed, logged repair.

1. **Start**: `Starta service` button on the home screen. Creates a *service session* (log entry of type `session`, status `open`).
2. **Vad säger displayen?** A checklist of everything the game's Test Report can say, straight from the manual (page 1-44/1-45), each with a short Swedish explanation:
   - `Check Switch ##` → a number pad / multi-select of switches (matrix 11–88, F1–F8, D1–D8), with name autocomplete.
   - `Pinball Missing`
   - `xxxxx Sw. is Stuck On` → pick the switch
   - `Ground Short Row-N, Wht-xxx` → pick the row
   - `Factory Settings Restored`
   - `U6 Checksum Error`
   - `Time and Date Not Set`
   - Sound-board beep codes (1–5 beeps), CPU LED blink codes (1–3)
   - Plus **"Något annat"** → the symptom list from `KNOWLEDGE.md` (flipper svag, spelet startar om, boll saknas, Thing, bokhyllan, GI-sträng, lampa/rad/kolumn, spole, säkring, ghosting, Thing Flips, display, ljud).
3. **Plan**: the app builds an ordered checklist. It merges causes: two switches on the same row become one step ("kolla radtråd Vit-röd / J208-2 först"); two EOS flags on the lower flippers become one mechanical step. Order: cheap and likely first (test-menu checks before disassembly), grouped by where you physically are (backbox / coin door / under playfield / top of playfield) so the playfield is raised once.
4. **Steg för steg**: one step per screen in workshop mode. Each step shows: what to do (e.g. "T.1 Switch Edges: aktivera switch 32 med en boll"), the expected result ("displayen visar `32 UPPER RIGHT JET`"), the component card (mini-map, wiring, part no.), buttons **Fungerar / Fel / Hoppa över / Anteckning / Foto**, and links to the manual page and the relevant guide. Answering "Fel" expands the branch (from the guide) into the next steps.
5. **Avslut**: summary — what was tested, what was fixed, what remains, parts to buy (auto-added to the shopping list as "att köpa"), and a one-tap "Spara i loggen". The session becomes a log entry with sub-items; open items reappear next time ("Förra gången lämnade du: EOS F3 ej justerad").
6. Sessions can be paused and resumed; the phone can die mid-session without losing anything (persist every answer immediately).

Acceptance: from a cold start, entering `32 68 F1 F3` and answering the steps produces a session with 4 components, the F1/F3 shared-cause step, per-step results, and a log entry, all readable offline afterwards; the whole flow is completable one-handed at 390 px.

### 5.2 P0 — Servicelogg

- Dated entries (Markdown body, tags, linked components `{kind,id}`, linked part numbers, photos, author name free-text or PocketBase user).
- Entry types: `session`, `repair`, `note`, `parts`, `settings-change`, `rom-change`.
- Timeline view with filters (component, tag, type, text). Component pages show their own history.
- Photos: captured or picked from the phone, stored locally (IndexedDB blobs) and synced when PocketBase is configured; downscaled to ≤ 2000 px on the long edge before storing.
- Seed the log with the entries in `docs/MACHINE.md` on first run (marked as imported).

### 5.3 P0 — Maskinens inställningar

- A catalogue of **every adjustment A.1 01 – A.5 xx** built from the handbook (name, description, choices/range, factory default where printed) plus the H-4-only adjustments listed in `KNOWLEDGE.md` (marked "ej i manualen").
- Columns: *Fabrik*, *Rekommenderat (kontor, free play)* (from `KNOWLEDGE.md` §Free play), *Nuvarande* (editable, persisted, with "ändrad av / när").
- Deviation highlighting between Nuvarande and Rekommenderat; a "gå igenom vid myntdörren" mode that steps through adjustments in menu order (A.1 01, A.1 02, …) as a checklist.
- Presets explained (U.9 01–11) with the exact tables from the handbook, and a warning banner on the ROM-swap guide: **"Byte av U6 nollställer alla justeringar — fyll i Nuvarande först."**
- Snapshot/restore: save a named snapshot of Nuvarande; diff two snapshots.

### 5.4 P0 — Symptomguider

- Each guide in `KNOWLEDGE.md` §Symptomguider becomes typed data (`guides/*.ts`): title, symptom, prerequisites, ordered steps with `{action, expect, ifFail → next steps or component refs, manualRefs, source: 'manual' | 'experience'}`.
- Rendered both as standalone pages (readable top to bottom) and as branches inside the service wizard.
- Every component reference is a link to the component page; every manual reference opens the page scan at that page.

### 5.5 P0 — Inköpslista

- Items: part no., name, quantity, chosen shop + URL, price (optional, with currency), status (`att köpa` / `beställd` / `mottagen` / `monterad`), linked log entry.
- Adding from a component page or a guide step pre-fills part no. and name from `data/parts.json`.
- Marking `monterad` offers to create a `repair` log entry linked to the component.
- Seed with the lists in `KNOWLEDGE.md` §Reservdelar and §LED (as suggestions, status `förslag`, not `att köpa`).

### 5.6 P1 — En sökning

One search box everywhere (`/` shortcut): component numbers and names, wire colours (`grön-blå` → switch column 6 and everything on it), transistors (`Q50`), connectors (`J127-6`), part numbers, handbook text, guide steps, log entries, adjustments (`A.1 20`, `custom message`). Grouped results, keyboard navigable, works offline.

### 5.7 P1 — Sektion 2–3 som tabeller

Transcribe the parts tables of Operations Manual section 2 (pages 2-2 … 2-38, one table per assembly, keep the exploded-view drawings as cropped images next to them) and the wiring tables of section 3 (3-16 … 3-20). Follow the conventions in `DATA-SCHEMA.md` §Handbook markdown. The wiring tables complete the wire-colour reverse lookup.

### 5.8 P1 — Verkstadsläge

A toggle (persisted) that switches to: 18 px base type, higher contrast, 48 px targets, bottom tab bar (Service · Karta · Sök · Logg), screen wake lock while a session is open, no hover-only affordances.

### 5.9 P1 — Myntdörrskort

A print stylesheet + `/print/coin-door` page: switch matrix, lamp matrix, fuse list, menu map and the machine's current key settings on two A4 pages, designed to be taped inside the coin door. Also downloadable as PDF from the browser's print dialog (no server).

### 5.10 P2 — Fråga handboken (optional, behind a flag)

A question box that answers in Swedish from the handbook transcription and guides, citing sections. Implement as a pluggable provider; ship with a local, non-LLM fallback (search results grouped by section) and document how to plug an LLM API key in. Do not make the app depend on it.

### 5.11 P2 — LED-planerare

From `KNOWLEDGE.md` §LED: per-lamp table (id, location, socket, bulb type, insert colour — editable, unknown by default), quantities per type, and a shopping-list generator. Low priority; the owner has deferred the LED conversion.

---

## 6. Data model (Dexie tables ⇄ PocketBase collections, same shapes)

All ids are ULIDs; all records carry `createdAt`, `updatedAt` (ISO), `deletedAt|null`, `deviceId`, `rev` (int). Sync = union by id, higher `updatedAt` wins, deletions are tombstones kept 90 days.

```ts
type ComponentRef = { kind: 'switch'|'lamp'|'coil'|'gi'|'fuse'|'flipper'|'board', id: string };

LogEntry { id, type: 'session'|'repair'|'note'|'parts'|'settings-change'|'rom-change',
  at, title, body /* markdown */, tags: string[], components: ComponentRef[],
  parts: string[] /* part numbers */, photos: string[] /* PhotoId */, author?: string,
  session?: { symptoms: SymptomInput[], steps: StepResult[], status: 'open'|'done' } }

ComponentStatus { id /* `${kind}:${id}` */, status: 'ok'|'fel'|'ej', note, at, byLog?: string }

SettingCurrent { id /* 'A.1 20' */, value: string, at, note?, snapshot?: string }
SettingSnapshot { id, name, at, values: Record<string,string> }

ShoppingItem { id, partNo?, name, qty, shop?, url?, price?: {amount:number,currency:string},
  status: 'förslag'|'att köpa'|'beställd'|'mottagen'|'monterad', components: ComponentRef[], logId?: string }

Photo { id, blob (local) | file (PocketBase), width, height, caption?, takenAt }

Machine { id: 'this', model: 'Bally The Addams Family 20017', serial?, romGame?: string /* 'H-4' */,
  romSound?: string, location?: string, pitchDeg?: number, notes?: string }
```

Static (build-time) data: everything in `data/*.json` and the adjustments catalogue generated from `content/handbook/*.md` (parse `### A.x NN Name` headings and their tables; see DATA-SCHEMA.md).

---

## 7. Design

**Working title:** *Valvet* ("The Vault" — the hidden room behind the bookcase where the machine keeps its secrets). The owner may rename it.

**Idea:** a Victorian mansion's workshop at night. Dark wood and iron, a parchment ledger for the log, and the one thing that glows: the amber dot-matrix display. Restraint over kitsch — no cobwebs, no dripping fonts, no skulls.

**Palette (tokens; define light equivalents; check AA on every pair):**

| Token | Dark | Light (parchment) | Use |
|---|---|---|---|
| `--ground` | `#0E0B10` | `#EFE9DA` | page |
| `--surface` | `#1A161D` | `#F8F4EA` | cards, tables |
| `--sunk` | `#242028` | `#E4DDCB` | inputs, wells |
| `--ink` | `#ECE6DA` | `#1C1720` | text |
| `--muted` | `#A79FAE` | `#5E5766` | secondary text |
| `--line` | `#35303B` | `#D3CBB8` | hairlines |
| `--amber` | `#FF8A3D` | `#C9520F` | DMD, primary action, active tab, focus |
| `--amber-glow` | `rgba(255,138,61,.45)` | none | text-shadow on DMD strings only |
| `--violet` | `#C9A0DC` | `#6A2D80` | headings, links |
| `--brass` | `#B08D57` | `#8A6B3A` | ornaments, rules, secondary chips |
| `--ok` / `--bad` / `--warn` | `#6FCB8B` / `#F0857B` / `#E3B557` | `#2F7D46` / `#B8322A` / `#A5720B` | status only, never decoration |

**Type (self-host from Google Fonts, with real fallbacks):**
- Display: **IM Fell English SC** for section titles and the app name (a real 17th-century face; period, not costume). Use sparingly, never for body or table text.
- UI/body: **IBM Plex Sans**.
- Data: **IBM Plex Mono** with `font-variant-numeric: tabular-nums` for every number column.
- DMD strings (the display's own messages such as `CHECK SWITCH 32`): Plex Mono, uppercase, letter-spaced, on a near-black well with a 4 px dot grid and the amber glow. This is the one glowing element on any screen.

**Motifs (all original SVG, drawn for this app):** a thin brass ornamental rule under section titles; a simple mansion silhouette as the empty-state illustration and app icon; a lightning flash (150 ms opacity pulse on the amber tokens) when a session step is saved — disabled under `prefers-reduced-motion`. Status chips shaped like service tags. Cards with a 1 px brass inset on hover only.

**Layout:** desktop 3 columns (navigation · content · context/details); tablet 2; phone single column with a bottom tab bar in workshop mode. Content measure 65–75 ch. Tables in their own horizontal scroll container, never the page.

**What you must not do:** do not reproduce the *Addams Family* logo, wordmark, the film's typography, John Youssi's playfield or backglass artwork, or depict the characters (Thing, Lurch, Gomez, Morticia, Cousin It, etc.). The manual's own line drawings (playfield maps, exploded views, board layouts) are used as technical reference images and must be shown as such (framed, captioned, with the page reference). The name "The Addams Family" may be used descriptively ("service app for a Bally *The Addams Family* pinball machine").

---

## 8. Quality bar

- Lighthouse (mobile): Performance ≥ 90, Accessibility 100, PWA installable. App shell + data + maps ≤ 3 MB precached; page scans lazy.
- Works with JS disabled for reading (handbook, component pages, tables); tools need JS.
- Playwright covers: guided session end to end (online and offline), map click → component, matrix keyboard navigation, log create/edit/export/import round-trip, settings snapshot diff, sync merge with a conflicting edit, both themes at 390 px and 1440 px.
- Vitest covers: code parser (`"32 68 F1 F3"`, `"Check Switch 32"`, `"L55"`, `"C07"`, `"Q50"`, `"grön-blå"`), shared-cause analysis, sync merge rules, adjustments catalogue parser (must find exactly the A.x headings present in the handbook).
- No console errors. TypeScript strict. ESLint clean.
- Every manual-sourced fact in the UI has a page reference; every `KNOWLEDGE.md`-sourced statement is marked "erfarenhet".

---

## 9. Milestones (ship each as a working deploy)

1. **M1 Grund + paritet**: scaffold, tokens, layouts, both themes, content collection, all data imported, prototype features re-implemented (§5.0), PWA shell, GitHub Pages deploy, Docker image with `BASE_PATH`.
2. **M2 Logg + foton + maskin**: Dexie, StorageAdapter, log timeline, photos, export/import, seed from `MACHINE.md`.
3. **M3 Inställningar**: catalogue parser, table, current values, snapshots, coin-door walkthrough mode.
4. **M4 Symptomguider + Starta service**: guides as data, wizard, shared-cause merging, session persistence, log integration.
5. **M5 Inköpslista** + links from components/guides/session.
6. **M6 En sökning** + section 2–3 transcription.
7. **M7 Verkstadsläge, wake lock, myntdörrskort, offline download of scans, PocketBase adapter + compose file.**
8. **M8 Polish**: motion, empty states, print, icons, README for the owner, screenshots.

Definition of done for each milestone: deployed, tests green, a short CHANGELOG entry, and a note of any data caveat surfaced.

---

## 10. Before you start, ask the owner (short list, then proceed with sensible defaults)

1. App name: keep *Valvet* or something else?
2. Symptom guides and wizard copy in Swedish (default) — confirm.
3. Deploy target first: GitHub Pages (default) or the home server sub-path? If the latter, which sub-path?
4. Should colleagues be able to write to the log without an account (local only per device) or via PocketBase accounts?
5. Photo storage: local only until PocketBase is configured (default)?

If you cannot get answers, proceed with the defaults above and note the assumptions in the README.

---

## Appendix A — Worked example of a guided session (use as the first Playwright scenario)

Input on 2026-09-22 (see `docs/MACHINE.md`): the display's Test Report says `Check Switch 32`, `68`, `F1`, `F3`.

**Plan the app should produce**

1. *Vid myntdörren* — `T.1 Switch Edges` open. (One step: enter the test.)
2. *Gemensam orsak* — F1 och F3 delar kontakt **J806** på Fliptronics och är båda EOS på de nedre flipprarna, medan F5/F7 inte är flaggade → "Kolla mekaniken på båda nedre flipprarna innan du felsöker elektriskt" (guide 1, punkt 3–6). Shown once, not per switch.
3. *På spelplanen, glaset av* — switch **32 Upper Right Jet**: knuffa skirten → förvänta `32 UPPER RIGHT JET`. Fel → guide 8 punkt 6 (bladgap under skirten), then guide 8 punkt 3 (diod, tråd).
4. *På spelplanen* — switch **68 Vault**: `T.13 Bookcase Test` för att öppna bokhyllan, tillbaka till T.1, släpp en boll i vaulten → förvänta `68 VAULT`. Reagerar → falsklarm (vaulten nås sällan). Fel → guide 8 punkt 3.
5. *Under spelplanen* — **F3 L. Flipper EOS**: lyft bladet för hand → förvänta `F3`. Fel → gap 0,062″, kontakter, bumper plug 23-6577, rebuild-kit. Then **F1** the same. Because the owner already found the lower-left bumper plug loose (MACHINE.md), the step should surface that log entry: "Förra gången: bumper plug lossnat här".
6. *Avslut* — summary; parts suggested: bumper plug ×2 / rebuild-kit ×2 → shopping list as `att köpa`; log entry `session` with four `StepResult`s and the shared-cause note; component statuses updated.

**What the test asserts**

- Steps are grouped by location in the order: myntdörr → spelplan → under spelplanen.
- Exactly one shared-cause step exists and it references both F1 and F3 and connector J806.
- Reloading the page mid-session (and going offline) restores the session at the same step with earlier answers intact.
- After "Spara", `/logg` shows the session, `/switch/32` shows its new status, and the shopping list has the two suggested items.
