import { describe, expect, it } from 'vitest';
import {
  fuseHref,
  handbookHref,
  href,
  manualHref,
  mapHref,
  markLabels,
  parseMapId,
  partHref,
  rowAnchor,
  tableHref,
  tablePath,
  tableSpotHref,
  verifyAnchor,
  verifyHref,
  verifyPath,
} from '~/lib/url';

describe('anchor links (AR3-05)', () => {
  it('builds the fuse, part, Verify and table-row anchors in one place', () => {
    expect(fuseHref('f114')).toBe(href('fuses#f114'));
    expect(fuseHref('leds')).toBe(href('fuses#leds'));
    expect(partHref('A-15017')).toBe(href('parts') + '#A-15017');
    expect(partHref('20-9247 12V')).toBe(href('parts') + '#20-9247%2012V');
    expect(verifyAnchor('flasher-count')).toBe('verify-flasher-count');
    expect(verifyPath('flasher-count')).toBe('verify#verify-flasher-count');
    expect(verifyHref('flasher-count')).toBe(href('verify#verify-flasher-count'));
    expect(rowAnchor('coil', '01')).toBe('coil-01');
    expect(tableSpotHref('flipper', { id: 'ULF' })).toBe(
      href(`coils#${rowAnchor('flipper', 'ULF')}`),
    );
  });
});

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

// The link helpers of audit P4 item 1, each against the inline `href()` it replaced.
describe('link helpers', () => {
  it('links the map with one layer on and one marker selected', () => {
    expect(mapHref('lamp', 13)).toBe(href('map?layer=lamp&id=13'));
    expect(mapHref('sw', '32')).toBe(href('map?layer=sw&id=32'));
    expect(mapHref('coil', '05').endsWith('/map?layer=coil&id=05')).toBe(true);
  });

  it('drops the Handbook hash only when no anchor is given', () => {
    expect(handbookHref('tests')).toBe(href('handbook/tests'));
    expect(handbookHref('tests', 'p17-2')).toBe(href('handbook/tests#p17-2'));
    // A stored reading anchor is any string; an empty one keeps its hash, as it always did.
    expect(handbookHref('tests', '')).toBe(href('handbook/tests#'));
  });

  it("names each kind's table page and links it, at a panel when asked", () => {
    expect(tablePath('switch')).toBe('switches');
    expect(tablePath('lamp')).toBe('lamps');
    expect(tablePath('coil')).toBe('coils');
    // The flipper coils are a table on the solenoid page (CR3-02).
    expect(tablePath('flipper')).toBe('coils');
    expect(tableHref('switch')).toBe(href('switches'));
    expect(tableHref('coil', 'flippers')).toBe(href('coils#flippers'));
    expect(tableHref('coil', 'gi')).toBe(href('coils#gi'));
  });
  it('links one part to its cell, its panel or its row (UX2-07)', () => {
    expect(tableSpotHref('switch', { id: '32' })).toBe(href('switches#c32'));
    expect(tableSpotHref('lamp', { id: '55' })).toBe(href('lamps#c55'));
    expect(tableSpotHref('switch', { id: 'D1', circuit: 'ded' })).toBe(href('switches#j205'));
    expect(tableSpotHref('switch', { id: 'F1', circuit: 'flip' })).toBe(href('switches#j806'));
    expect(tableSpotHref('coil', { id: '01' })).toBe(href('coils#coil-01'));
    expect(tableSpotHref('flipper', { id: 'ULF' })).toBe(href('coils#flipper-ULF'));
  });

  it('links a manual page with its callouts to ring, and reads them back (UX2-07)', () => {
    expect(manualHref('ops', 97)).toBe(href('manual/ops/97'));
    expect(manualHref('ops', 97, [])).toBe(href('manual/ops/97'));
    expect(manualHref('ops', 97, ['32'])).toBe(href('manual/ops/97?mark=32'));
    expect(manualHref('ops', 98, ['13', '14'])).toBe(href('manual/ops/98?mark=13,14'));
    expect(manualHref('ops', 97, ['44b', '44a', '44b', '44a'])).toBe(
      href('manual/ops/97?mark=44b,44a'),
    );
    expect(markLabels('?mark=13,14')).toEqual(['13', '14']);
    expect(markLabels('?mark=')).toEqual([]);
    expect(markLabels('')).toEqual([]);
    expect(markLabels('?x=1')).toEqual([]);
  });
});
