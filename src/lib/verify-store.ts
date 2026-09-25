/**
 * The Verify checklist's device store: the key and the loader, shared by verify-check.ts (which
 * enhances the page and runs on import) and the Workshop hub (which only counts the ticks).
 */
export const KEY = 'tafh:verify';

/** id → ISO date of the tick. */
export type VerifyTicks = Record<string, string>;

export function loadVerifyTicks(): VerifyTicks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as VerifyTicks;
  } catch {
    return {};
  }
}

export function saveVerifyTicks(t: VerifyTicks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* private mode */
  }
}
