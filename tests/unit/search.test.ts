import { describe, expect, it } from 'vitest';
import { componentHits, manualHits, preview, queryWords, search, snippet } from '~/lib/search';
import type { Hit } from '~/lib/search';

const components = componentHits();
const codes = (hits: Hit[]) => hits.map((h) => h.code);
const find = (q: string) => search(components, queryWords(q));

describe('search', () => {
  it('ranks the flipper switches and coils before the lanes named after them (spec §9.3)', () => {
    const hits = codes(find('flipper'));
    expect(hits).toHaveLength(20);
    expect(hits.slice(0, 3)).toEqual(['F1', 'F2', 'F3']);
    for (const lane of ['25', '76', '78']) {
      expect(hits.indexOf('LLF')).toBeLessThan(hits.indexOf(lane));
    }
    expect(hits).toContain('F101');
    // The All preview spreads over the kinds: five rows, at most three of one kind, so two flipper
    // coils follow the switches (in data order; the spec's example names LLF).
    expect(codes(preview(find('flipper'), 5, 3))).toEqual(['F1', 'F2', 'F3', 'ULF', 'URF']);
  });

  it('puts the exact code first', () => {
    expect(codes(find('LLF'))[0]).toBe('LLF');
    expect(codes(find('f1'))[0]).toBe('F1');
    expect(codes(find('F101'))[0]).toBe('F101');
  });

  it('needs every word, and keeps the source order among equals', () => {
    expect(codes(find('flipper button'))).toEqual(['F2', 'F4', 'F6', 'F8']);
    expect(find('flipper zzz')).toEqual([]);
    expect(search(components, [])).toEqual([]);
    expect(search(null, ['flipper'])).toEqual([]);
  });

  it('a short word matches the manuals at a word start; garbled text ranks last (UX3-03)', () => {
    const pages = manualHits({
      ops: [
        'The LLF coil is the lower left flipper, driven from J130-1 on the Fliptronics board.',
        'relay xllfq driver 3zzq',
        'llf q9z rr1k x7y a1b2 kq7p 9zz',
        '',
      ],
    });
    expect(pages).toHaveLength(3);
    const words = queryWords('LLF');
    const found = search(pages, words);
    expect(found.map((h) => h.id)).toEqual(['manuals:ops:0', 'manuals:ops:2']);
    expect(snippet(found[0]!, words)).toMatch(/^The LLF coil is the lower left flipper/);
    // A longer word still matches inside one.
    expect(search(pages, queryWords('flipper')).map((h) => h.id)).toEqual(['manuals:ops:0']);
    expect(search(pages, queryWords('relay')).map((h) => h.id)).toEqual(['manuals:ops:1']);
  });
});
