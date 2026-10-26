import type { OfflineProgress } from './events';

/** A late-hydrating Workshop reads the same progress the PWA already published. */
export function readOfflineProgress(): OfflineProgress {
  const data = typeof document === 'undefined' ? undefined : document.documentElement.dataset;
  const state = data?.warm;
  return {
    state:
      state === 'loading' || state === 'done' || state === 'partial' || state === 'skip'
        ? state
        : 'idle',
    done: Number(data?.warmDone ?? 0),
    total: Number(data?.warmTotal ?? 0),
  };
}
