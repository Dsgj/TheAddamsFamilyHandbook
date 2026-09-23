# Fault checklist + shopping list — TODO (spec agreed 2026-09-23)

Owner decision: a "broken" tick per component on the Lamps, Switches and Solenoids pages, and a
Shopping list page that gathers every part marked Fault with part numbers. All component kinds,
not only lamps.

## Behaviour

- **Tick = Fault.** A checkbox "Broken" per row/cell writes `setStatus(kind, id, 'fault')`; unticking
  writes `''` (clears) unless a note exists, then keep the note (`setStatus(kind, id, '', note)`).
  Reuses the existing device-local status (`tafh:status`), so the map markers and component cards
  show the same red state. No new storage.
- **Where the tick lives**
  - Lamps: new lamp table (id, name, bulb, bulbPart, assy, Broken) under the matrix in
    `src/pages/lamps.astro` (page currently has only the matrix). Matrix cells already colour by
    status; add a tap-to-toggle in `Matrix.svelte` only if it does not conflict with the existing
    keyboard navigation / card open. Table tick is the must-have.
  - Switches: Broken column in the two tables in `src/pages/switches.astro` (lines ~28 and ~54)
    and a new column in the matrix-adjacent full list if one exists.
  - Solenoids: Broken column in the three tables in `src/pages/coils.astro` (~25, ~75, ~111).
- **Shopping list page** `src/pages/shopping.astro` + island `src/components/ShoppingList.svelte`
  (client:load). Nav entry `['shopping', 'Shopping list', 'shopping']` in `src/layouts/Base.astro`
  line ~31. Content:
  - Lamps grouped by bulb type (`bulb`: #555 / #44 / #906) with count, bulbPart, and the lamp ids +
    names in each group.
  - Switches and coils listed with `part`, `assy`, id, name.
  - Each row links to its component card (`componentHref(kind, id)`).
  - "Copy as text" button (navigator.clipboard, fallback: select a textarea). Plain-text format:
    `4 × #555 (24-8768): L11 Thing Multiball, L12 …`.
  - Empty state: "Nothing marked Fault yet. Tick Broken on the Lamps, Switches or Solenoids page."
  - Per-row "Fixed" (clears status) so the list doubles as a work list.

## Implementation notes

- Tables are static Astro. Render `<input type="checkbox" class="fault-check" data-kind data-id>`
  in each row and enhance with **one** page-level `<script>` per page that imports
  `getStatus/setStatus` from `~/lib/model/status.svelte` (module-level `$state` works in
  `.svelte.ts` without a component). No island per row (would be ~170 hydrations).
  Verify: after ticking in the table, the Matrix island on the same page recolours live. If the
  Astro `<script>` and the island get separate module instances, fall back to a `storage`-style
  custom event (`window.dispatchEvent(new CustomEvent('tafh:status'))`) that Matrix listens to.
- ShoppingList island must not import `DATA` (keeps components.json out of the client bundle).
  Pass a compact prop from the page: `{kind, id, name, part, bulb, assy}[]` built in frontmatter
  from `DATA.lamps/switches/coils` (`bulbPart` → `part` for lamps).
- `Kind` = `'switch' | 'lamp' | 'coil'` (`src/lib/model/types.ts:144`). Status API:
  `getStatus, setStatus, setNote, allStatuses, clearStatuses, STATUS_LABEL` in
  `src/lib/model/status.svelte.ts`. Status CSS classes `.st-ok/.st-fault/.st-untested` in
  `src/styles/base.css:219`.
- Existing pattern for the tick control: `src/components/StatusRow.svelte` (aria-pressed buttons).
  Checkbox is fine for the table; keep `aria-label="Broken: <name>"`.
- Tests: unit test for the grouping/format function (put it in `src/lib/shopping.ts`, pure), e2e:
  tick L11 on /lamps → /shopping shows "1 × #555" → Copy button present → "Fixed" clears it.
  Existing e2e status test: `tests/e2e/smoke.spec.ts:60`.
- Update README Features table (Status row → mention Broken tick + Shopping list), CHANGELOG
  Unreleased.

## Gates
`pnpm check` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm test:e2e`
(stop stray preview first: `pnpm exec astro preview stop`).

## State
Done 2026-09-23, uncommitted (user has not asked for a commit). All gates green: check, lint, 18 unit
tests, build, e2e 20/20 three runs in a row.

Files: src/lib/shopping.ts (+ tests/unit/shopping.test.ts), src/components/ShoppingList.svelte,
src/pages/shopping.astro, src/lib/fault-check.ts (page script, imported by lamps/switches/coils),
Broken column in lamps (new lamp table) / switches (J205, J806) / coils (three group tables),
nav entry, .fault-check CSS in base.css, README + CHANGELOG, tests/e2e/shopping.spec.ts.

Decisions: flipper coils and GI strings got no tick (no Kind, no card). Matrix tap-to-toggle not
added (table tick is the must-have). Shared module instance between page script and island
confirmed by e2e (matrix recolours live), no custom event needed.

Side fix: tests/e2e/helpers.ts gotoHydrated() waits for client:load islands before tests click
into them; map-marker and status tests raced hydration under parallel load once the suite grew.

Next: commit when asked; optional M-later: tick on flipper coils / GI, matrix tap-to-toggle.
