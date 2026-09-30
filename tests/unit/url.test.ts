import { describe, expect, it } from 'vitest';
import { parseMapId } from '~/lib/url';

describe('parseMapId', () => {
  it('reads every kind-qualified id exactly', () => {
    expect(parseMapId('switch:32')).toEqual({ kind: 'switch', id: '32' });
    expect(parseMapId('lamp:55')).toEqual({ kind: 'lamp', id: '55' });
    expect(parseMapId('coil:F1')).toEqual({ kind: 'coil', id: 'F1' });
    expect(parseMapId('shot:K')).toEqual({ kind: 'shot', id: 'K' });
  });
  it('keeps a bare id bare, for the lookup in the layers that are on', () => {
    expect(parseMapId('32')).toEqual({ id: '32' });
    expect(parseMapId('F1')).toEqual({ id: 'F1' });
  });
  it('treats an unknown prefix as part of a bare id, and nothing as nothing', () => {
    expect(parseMapId('bogus:32')).toEqual({ id: 'bogus:32' });
    expect(parseMapId('lamp:')).toBeNull();
    expect(parseMapId('')).toBeNull();
    expect(parseMapId(null)).toBeNull();
  });
});
