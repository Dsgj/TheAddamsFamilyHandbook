import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPENDICES,
  appendixAnchor,
  appendixFor,
  appendixHref,
  COIL_OHMS,
  coilOhms,
  serviceNotes,
} from '~/data/appendix';
import { OWNER_NOTES } from '~/data/ownerNotes';
import { DATA } from '~/lib/data/components';
import { VERIFY_ITEMS } from '~/data/verify';
import { findHeading, finish, indexHeadings, parseHeader, renderPage } from '~/lib/handbook/render';
import { APPENDIX_FIRST_PAGE, SECTIONS, isAppendixPage } from '~/lib/handbook/sections';
import { href } from '~/lib/url';

const dir = 'src/content/handbook';
const appFiles = readdirSync(dir).filter((f) => /^app\d+\.md$/.test(f));

const allComponents = () => [
  ...DATA.switches.map((i) => ['switch', i] as const),
  ...DATA.lamps.map((i) => ['lamp', i] as const),
  ...DATA.coils.map((i) => ['coil', i] as const),
  ...DATA.flippers.map((i) => ['flipper', i] as const),
];

describe('owner appendices', () => {
  it('has one file per appendix code, each on an appendix page with a matching heading', () => {
    const codes = new Set<string>();
    for (const f of appFiles) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      const m = /^<!-- page (\d+) \| label (A\d) -->/.exec(src);
      expect(m, `${f} header`).toBeTruthy();
      expect(isAppendixPage(Number(m![1]))).toBe(true);
      expect(src).toMatch(new RegExp(`^## ${m![2]} ${APPENDICES[m![2]!]}$`, 'm'));
      codes.add(m![2]!);
    }
    expect([...codes].sort()).toEqual(Object.keys(APPENDICES).sort());
  });

  it('keeps the appendix section last and its pages out of the manual range', () => {
    const sec = SECTIONS.at(-1)!;
    expect(sec.key).toBe('appendix');
    expect(Math.min(...sec.pages)).toBe(APPENDIX_FIRST_PAGE);
    expect(
      SECTIONS.slice(0, -1)
        .flatMap((s) => s.pages)
        .every((p) => !isAppendixPage(p)),
    ).toBe(true);
  });

  it('resolves appendixAnchor to the same heading id as a #find: link', () => {
    const pages = appFiles.map((f) => {
      const { page, label, body } = parseHeader(readFileSync(`${dir}/${f}`, 'utf8'));
      return renderPage(page!, body, label);
    });
    const idx = indexHeadings(pages);
    for (const code of Object.keys(APPENDICES)) {
      expect(findHeading(idx, code)?.id, code).toBe(appendixAnchor(code));
    }
  });

  it('links each appendix code to its heading on the appendix page', () => {
    expect(appendixHref('A6')).toBe(href('handbook/appendix#p106-1'));
    for (const code of Object.keys(APPENDICES))
      expect(appendixHref(code)).toBe(href('handbook/appendix#' + appendixAnchor(code)));
  });

  it('maps every component to known codes, most specific first and A1 last', () => {
    for (const [kind, item] of allComponents()) {
      const codes = appendixFor(kind, item);
      expect(codes.length).toBeGreaterThanOrEqual(3);
      expect(codes.at(-1)).toBe('A1');
      expect(new Set(codes).size).toBe(codes.length);
      for (const c of codes) expect(APPENDICES[c], `${kind} ${item.id} → ${c}`).toBeTruthy();
    }
    expect(
      appendixFor(
        'switch',
        DATA.switches.find((s) => /End of Stroke/.test(s.name))!,
      )[0],
    ).toBe('A6');
    expect(
      appendixFor(
        'coil',
        DATA.coils.find((c) => /Magnet/.test(c.name))!,
      )[0],
    ).toBe('A2');
    expect(
      appendixFor(
        'coil',
        DATA.coils.find((c) => /Lightning/.test(c.name))!,
      )[0],
    ).toBe('A4');
    expect(
      appendixFor(
        'coil',
        DATA.coils.find((c) => /Bookcase Motor/.test(c.name))!,
      )[0],
    ).toBe('A2');
    // A flipper coil: the flipper appendix first, then the solenoid one (CR3-02).
    expect(appendixFor('flipper', DATA.flippers[0]!)).toEqual(['A6', 'A2', 'A5', 'A1']);
  });

  it('gives every component a plain-text service note from its first appendix', () => {
    for (const [kind, item] of allComponents()) {
      const notes = serviceNotes(item);
      expect(notes.length, `${kind} ${item.id}`).toBeGreaterThan(0);
      for (const n of notes) {
        expect(APPENDICES[n.code]).toBeTruthy();
        expect(n.text.length).toBeGreaterThan(80);
        expect(n.text).not.toMatch(/undefined|null|NaN/);
      }
      expect(notes[0]!.code).toBe(appendixFor(kind, item)[0]);
    }
    const ulf = DATA.flippers.find((f) => f.id === 'ULF')!;
    expect(serviceNotes(ulf)[0]!.text).toContain('9.8 / 165 Ω');
    expect(serviceNotes(ulf)[0]!.text).toContain('F901 (3A S.B.)');
    const swamp = DATA.coils.find((c) => /Swamp Release/.test(c.name))!;
    expect(serviceNotes(swamp)[0]!.text).toContain('41 Ω');
    expect(serviceNotes(swamp)[0]!.text).toContain('J122');
    expect(coilOhms('14-7966 12V')).toBeUndefined();
    expect(coilOhms('AE-26-1200')?.mark).toBe('vendor');
  });

  it('never calls the flipper buttons optos: a line naming both says they are not (audit DA3-03)', () => {
    for (const f of appFiles) {
      const lines = readFileSync(`${dir}/${f}`, 'utf8').split('\n');
      for (const line of lines) {
        if (/button/i.test(line) && /opto/i.test(line))
          expect(line, `${f}: ${line}`).toMatch(/leaf/);
      }
    }
    const a3 = readFileSync(`${dir}/app103.md`, 'utf8');
    expect(a3).toContain('the buttons on J805');
    expect(a3).not.toMatch(/buttons are opto/);
  });

  it('links the open questions to Verify items that exist (audit DA2-01, DA2-03)', () => {
    const ids = new Set(VERIFY_ITEMS.map((v) => v.id));
    const linked = appFiles.flatMap((f) =>
      [...readFileSync(`${dir}/${f}`, 'utf8').matchAll(/\(#verify:([a-z0-9-]+)\)/g)].map(
        (m) => m[1]!,
      ),
    );
    expect(linked.sort()).toEqual(['magnet-fuse', 'magnet-supply']);
    for (const id of linked) expect(ids.has(id), id).toBe(true);
    const { page, label, body } = parseHeader(readFileSync(`${dir}/app105.md`, 'utf8'));
    const p = renderPage(page!, body, label);
    const html = finish(p, indexHeadings([p]), '/base');
    expect(html).toContain('href="/base/verify#verify-magnet-supply"');
    expect(html).not.toContain('#verify:');
  });

  it('keeps COIL_OHMS equal to the A2 and A6 tables (audit AR2-05)', () => {
    /** The body rows of the table whose header row starts with `header`, as trimmed cells. */
    const table = (file: string, header: string) => {
      const lines = readFileSync(`${dir}/${file}`, 'utf8').split(/\r?\n/);
      const start = lines.findIndex((l) => l.startsWith(header));
      expect(start, `${file}: ${header}`).toBeGreaterThan(-1);
      const body = [];
      for (const l of lines.slice(start + 2)) {
        if (!l.startsWith('|')) break;
        body.push(
          l
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim()),
        );
      }
      return body;
    };
    const fromTables: Record<string, { ohms: string; mark: string }> = {};
    // The motors have no published value and the flipper row points to A6.
    for (const [part, ohms, , conf] of table('app102.md', '| Coil | Typical Ω |')) {
      if (!/^(about )?\d/.test(ohms!)) continue;
      const mark = /^measured/.test(conf!) ? 'measured' : /vendor/.test(conf!) ? 'vendor' : 'forum';
      fromTables[part!] = { ohms: ohms!, mark };
    }
    // A6 gives the vendor's power and hold windings.
    for (const [, coil, power, hold] of table('app106.md', '| Flipper | Coil |')) {
      const ohm = (v: string) => v.replace(/\s*Ω$/, '');
      fromTables[coil!.split(' ')[0]!] = { ohms: `${ohm(power!)} / ${ohm(hold!)}`, mark: 'vendor' };
    }
    expect(fromTables).toEqual(COIL_OHMS);
  });

  it("keeps owner's notes on manual pages with valid appendix codes", () => {
    const manualPages = new Set(SECTIONS.slice(0, -1).flatMap((s) => s.pages));
    for (const [page, notes] of Object.entries(OWNER_NOTES)) {
      expect(manualPages.has(Number(page)), `page ${page}`).toBe(true);
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(APPENDICES[n.code], `page ${page} → ${n.code}`).toBeTruthy();
        expect(n.text.length).toBeGreaterThan(60);
      }
    }
  });
});
