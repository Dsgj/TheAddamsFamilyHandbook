# Appendix integration — PROPOSAL (2026-09-24, not yet approved)

**Status 2026-09-24: all seven surfaces implemented, gauntlet green, committed.** Backbox inspection (observed 2026-09-24, photo) folded in, committed as `9339eba`: L-4 on M27C2001 in U6, anyPin NVRAM in U8 (no batteries), TIP102 row 9910, board date codes 9206–9218, taped J-numbers, serial '20017 …' partial. Targets: kit-docs/MACHINE.md (machine card rows, log entry, open items), kit-docs/KNOWLEDGE.md (§1, §2 rows, guides 1/2/13, §4 A.1 24 = NO, §5), setup.ts (A.1 24 item, h4 intro, `batteries` renamed to NVRAM check), care.ts (both battery items → NVRAM/U8 wording), ownerNotes p.54, app105/app106, verify.astro group 'This machine', care.spec.ts hasText 'NVRAM'. Photos NOT attached: owner to drop them at kit-docs/photos/2026-09-24-backbox/01..06.jpg. Owner reports 2026-09-24: the Thing Knocker (02) has no coil, only the A-15267 bracket and rubber pad; treated as a future upgrade (Setup upkeep item `thing-knocker`, coil 02 note, A2 table). AE-23-800 is measured on 07 Thing Kickout instead. Measured 2026-09-24: 07 Thing Kickout 4.9 Ω on the meter, leads 0.1–0.2 Ω (A1 rule 8), recorded as 4.7–4.8, recorded in A2 and COIL_OHMS as measured. Knocker harness ends in a 2-pin connector in the cabinet: violet-yellow (50 V high-power supply, manual power-circuit table PDF p. 121) plus one wire the owner will report the colour of (expected violet-red, Q80/J132-2). When it arrives: add the connector facts (colours, pin count/housing) to the `thing-knocker` why text in `src/data/setup.ts`. Owner found a 3-wire connector (black-yellow, blue-violet, orange-violet) = right flipper button stack, J805-1/-3/-6; A6 and button notes corrected from optos to leaf switches. Knocker's second wire still unreported. Owner proposed a per-coil measured-resistance feature (pending design approval). Knocker note on coil 02, setup item, A2 row 4.9 Ω and CHANGELOG committed in `28aaa52`. Remaining: the owner\'s machine measurements below; when they arrive, update the A2/A3/A6 tables and `COIL_OHMS` in `src/data/appendix.ts` (mark forum → measured).

Owner intent: the owner appendices A1–A8 (`src/content/handbook/app101–108.md`)
must be *applied* in plain text where they matter in the guides, not only
linked. Today they are links only, except Care yearly.

## Where they are used today

- Component pages (`src/layouts/ComponentPage.astro` ~line 31–50): a
  "Service notes:" line of links from `appendixFor()` in `src/data/appendix.ts`.
  No text.
- Care (`src/data/care.ts`): yearly items carry plain-text summaries + `find`
  A5/A2/A4/A7; half-year intro names A8; warning names A7. Done.
- Setup (`src/data/setup.ts`): no appendix use at all.
- Verify (`src/pages/verify.astro`): `eos-type` item, no link to A6.
- Diagnose / shared cause (`src/lib/shared-cause.ts`, `Diagnose.svelte`):
  own wording, no appendix text.
- Manual pages (ops*.md): no "owner's note" back to the appendices.
- Shopping list (`src/pages/shopping.astro`): no A7 kit.

## Proposed surfaces, in order

1. Component pages: replace the link line with a "Service notes" block of 2–4
   sentences specific to the component kind, plus the appendix link.
   - Coil: measure across the two lugs, expected ohms for *this* part number
     (coil table from A2, values marked forum until measured), diode, driver
     transistor (from the component's own data), fuse. Magnets: A-15416, J903.
   - Switch: gap 1/16", card stock, diode, column/row; EOS: A6 text.
   - Lamp: socket/column/row, ghosting note for LEDs.
   - Flipper coils: EOS + coil table + rebuild order.
   Implementation: `serviceNotes(kind, item)` in `src/data/appendix.ts`
   returning `{code, text}[]`; rendered in ComponentPage.astro. Unit test.
2. Setup "Upgrades and upkeep": batteries → A5 holder/leak text; flipper links
   → A6 rebuild order; LED kit → A4 ghosting; each with `find` to the appendix.
3. Diagnose shared-cause texts: one sentence each from A3 (U20 / row comparator
   for switch column/row) and A4 (lamp column driver) with a link.
4. Verify `eos-type`: link to A6 and quote the manual conflict.
5. Care monthly `care-switch-test` → A3 (card stock, never a file); half-year
   `care-sleeves` → A6.
6. Manual pages: an "Owner's note" callout on the pages the appendices extend
   (solenoid table p.2, switch matrix, fuse list, Maintenance Information,
   Problem Diagnosis) — data map page→[code, sentence] rendered by
   `[section].astro`.
7. Shopping list: the A7 kit (Trifurcon .156/.100, crimp tool, housings,
   D5 or 60 PLUS, D100L, IPA, card stock) as a fixed "Service kit" section.

Verification: prettier, astro check, eslint, vitest (+ new unit test for
serviceNotes), build, `grep -c 'data-find=' dist/**/*.html` = 0, Playwright
handbook/setup/care/appendix.

## Still pending from the owner (machine measurements)

Coil ohms AE-26-1500 / AE-27-1200 / AE-30-2000, Thing magnet
A-12158-1, EOS at rest (lower + upper), opto resistor colour code (2-opto board
under Thing hand, bookcase 4-opto), interlock present + cuts in T.4, U20 socket
or soldered. Instructions were given in chat 2026-09-24. When they arrive:
update A2/A3/A6 tables and change marks from forum to measured.
