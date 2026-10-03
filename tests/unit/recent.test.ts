import { describe, expect, it } from 'vitest';
import { parseCodes } from '~/lib/codes';
import { tidyInput } from '~/lib/model/recent.svelte';

const keys = (s: string) => parseCodes(s).map((c) => `${c.kind}:${c.id}`);
const REPORT = ['TEST REPORT', 'CHECK SWITCH 32', 'LEFT FLIPPER EOS', '68 IS STUCK ON'].join('\n');

describe('Recent', () => {
  it('keeps the lines of a pasted report, so it replays to the same codes (CO2-02)', () => {
    const pasted = [
      '  TEST   REPORT ',
      '',
      'CHECK SWITCH 32\r',
      'LEFT FLIPPER EOS',
      '68 IS STUCK ON',
    ];
    const kept = tidyInput(pasted.join('\n'));
    expect(kept).toBe(REPORT);
    expect(keys(kept)).toEqual(keys(REPORT));
    // What flattening it did: the words of one line ran into the next.
    expect(keys(REPORT.replaceAll('\n', ' '))).not.toEqual(keys(REPORT));
  });
});
