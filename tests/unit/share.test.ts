import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText, shareText } from '~/lib/share';

let toasts: unknown[];

beforeEach(() => {
  const win = new EventTarget();
  toasts = [];
  win.addEventListener('tafh:toast', (e) => toasts.push((e as CustomEvent).detail));
  vi.stubGlobal('window', win);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const clipboard = (ok: boolean) => ({
  writeText: vi.fn(() => (ok ? Promise.resolve() : Promise.reject(new Error('denied')))),
});

describe('copy and share (AR2-15)', () => {
  it('a copy says so in a toast', async () => {
    vi.stubGlobal('navigator', { clipboard: clipboard(true) });
    expect(await copyText('x', 'Copied it.')).toBe(true);
    expect(toasts).toEqual([{ kind: 'info', text: 'Copied it.' }]);
  });

  it('a refused or missing clipboard answers false, without a toast', async () => {
    vi.stubGlobal('navigator', { clipboard: clipboard(false) });
    expect(await copyText('x')).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(await copyText('x')).toBe(false);
    expect(toasts).toEqual([]);
  });

  it('shares through the system sheet; cancelling it is an answer', async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { share, clipboard: clipboard(true) });
    expect(await shareText('T', 'x')).toBe(true);
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'x' });
    share.mockImplementationOnce(() => Promise.reject(new DOMException('no', 'AbortError')));
    expect(await shareText('T', 'x')).toBe(true);
    expect(toasts).toEqual([]);
  });

  it('copies where there is no sheet or the sheet fails', async () => {
    const cb = clipboard(true);
    vi.stubGlobal('navigator', { clipboard: cb });
    expect(await shareText('T', 'x')).toBe(true);
    const share = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    vi.stubGlobal('navigator', { share, clipboard: cb });
    expect(await shareText('T', 'y')).toBe(true);
    expect(cb.writeText.mock.calls).toEqual([['x'], ['y']]);
    expect(toasts).toHaveLength(2);
  });
});
