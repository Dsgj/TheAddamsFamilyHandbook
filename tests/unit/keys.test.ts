import { describe, expect, it } from 'vitest';
import { letterKey, zoomKey } from '~/lib/keys';

describe('shortcut keys (SV2-16)', () => {
  it('reads + and = as in, - and _ as out, 0 as the fit', () => {
    expect(['+', '=', '-', '_', '0'].map(zoomKey)).toEqual(['in', 'in', 'out', 'out', 'fit']);
    expect(['1', 'a', 'Escape', 'constructor', ''].map(zoomKey)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
  it('compares a letter without case and leaves named keys out', () => {
    expect(['r', 'R', 'T', 'w'].map(letterKey)).toEqual(['r', 'r', 't', 'w']);
    expect(letterKey('ArrowLeft')).toBe('');
    expect(letterKey('Shift')).toBe('');
  });
});
