import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emit, eventType, listen, toast } from '~/lib/events';

let win: EventTarget;

beforeEach(() => {
  win = new EventTarget();
  vi.stubGlobal('window', win);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('app events (AR2-09, SV2-11)', () => {
  it('raises and hears an event on window under its tafh: type', () => {
    const heard: string[] = [];
    const raw: unknown[] = [];
    listen('map', (what) => heard.push(what));
    win.addEventListener('tafh:map', (e) => raw.push((e as CustomEvent).detail));
    emit('map', 'parts');
    expect(heard).toEqual(['parts']);
    expect(raw).toEqual(['parts']);
    expect(eventType('check-update')).toBe('tafh:check-update');
  });

  it('hears an event a spec raises by hand', () => {
    const heard: unknown[] = [];
    listen('toast', (d) => heard.push(d));
    win.dispatchEvent(new CustomEvent('tafh:toast', { detail: { kind: 'info', text: 'Hi' } }));
    expect(heard).toEqual([{ kind: 'info', text: 'Hi' }]);
  });

  it('stops with the function listen returns, and once hears one event', () => {
    let all = 0;
    let first = 0;
    const off = listen('content', () => all++);
    listen('content', () => first++, { once: true });
    emit('content');
    off();
    emit('content');
    expect(all).toBe(1);
    expect(first).toBe(1);
  });

  it('toast raises the toast event', () => {
    const heard: unknown[] = [];
    listen('toast', (d) => heard.push(d));
    toast('info', 'Copied to the clipboard.');
    expect(heard).toEqual([{ kind: 'info', text: 'Copied to the clipboard.' }]);
  });

  it('does nothing without window (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => emit('reload')).not.toThrow();
    expect(() => listen('reload', () => {})()).not.toThrow();
  });
});
