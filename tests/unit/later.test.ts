import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { later } from '~/lib/later';

describe('later', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the second message for its full time', () => {
    const t = later();
    let msg = 'first';
    t.set(() => (msg = ''), 4000);
    vi.advanceTimersByTime(3000);
    msg = 'second';
    t.set(() => (msg = ''), 4000);
    vi.advanceTimersByTime(3500);
    expect(msg).toBe('second');
    vi.advanceTimersByTime(500);
    expect(msg).toBe('');
  });

  it('clear drops the pending call', () => {
    const t = later();
    const fn = vi.fn();
    t.set(fn, 100);
    t.clear();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});
