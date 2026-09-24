import { describe, expect, it } from 'vitest';
import { CARE_ITEM_COUNT, CARE_STEPS } from '~/data/care';
import { SETUP_STEPS } from '~/data/setup';

describe('care data', () => {
  const ids = CARE_STEPS.flatMap((s) => s.items.map((i) => i.id));

  it('has unique item ids and a matching count', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(CARE_ITEM_COUNT).toBe(ids.length);
  });

  it('is ordered from the shortest interval to the longest', () => {
    expect(CARE_STEPS.map((s) => s.id)).toEqual(['weekly', 'monthly', 'halfyear', 'yearly']);
  });

  it('shares only the battery tick with the setup guide', () => {
    const setupIds = new Set(SETUP_STEPS.flatMap((s) => s.items.map((i) => i.id)));
    expect(ids.filter((id) => setupIds.has(id))).toEqual(['batteries']);
  });

  it('is all tasks: nothing has a suggested value', () => {
    expect(CARE_STEPS.flatMap((s) => s.items).every((i) => i.suggested === '')).toBe(true);
  });
});
