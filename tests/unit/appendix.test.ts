import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPENDICES, appendixAnchor, appendixFor, coilOhms, serviceNotes } from '~/data/appendix';
import { OWNER_NOTES } from '~/data/ownerNotes';
import { DATA } from '~/lib/data/components';
import { findHeading, indexHeadings, parseHeader, renderPage } from '~/lib/handbook/render';
import { APPENDIX_FIRST_PAGE, SECTIONS, isAppendixPage } from '~/lib/handbook/sections';

const dir = 'src/content/handbook';
const appFiles = readdirSync(dir).filter((f) => /^app\d+\.md$/.test(f));

const allComponents = () => [
  ...DATA.switches.map((i) => ['switch', i] as const),
  ...DATA.lamps.map((i) => ['lamp', i] as const),
  ...DATA.coils.map((i) => ['coil', i] as const),
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
  });

  it('gives every component a plain-text service note from its first appendix', () => {
    for (const [kind, item] of allComponents()) {
      const notes = serviceNotes(kind, item);
      expect(notes.length, `${kind} ${item.id}`).toBeGreaterThan(0);
      for (const n of notes) {
        expect(APPENDICES[n.code]).toBeTruthy();
        expect(n.text.length).toBeGreaterThan(80);
        expect(n.text).not.toMatch(/undefined|null|NaN/);
      }
      expect(notes[0]!.code).toBe(appendixFor(kind, item)[0]);
    }
    const swamp = DATA.coils.find((c) => /Swamp Release/.test(c.name))!;
    expect(serviceNotes('coil', swamp)[0]!.text).toContain('41 Ω');
    expect(serviceNotes('coil', swamp)[0]!.text).toContain('J122');
    expect(coilOhms('14-7966 12V')).toBeUndefined();
    expect(coilOhms('AE-26-1200')?.mark).toBe('vendor');
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
