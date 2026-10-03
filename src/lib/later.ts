/**
 * One pending timeout. Setting it again drops the one before, so an older timer never clears a
 * newer message or disarms a newer confirm early (CO2-12, SV2-07).
 */
export interface Later {
  set(fn: () => void, ms: number): void;
  clear(): void;
}

export function later(): Later {
  let id: ReturnType<typeof setTimeout> | undefined;
  return {
    set(fn, ms) {
      clearTimeout(id);
      id = setTimeout(() => {
        id = undefined;
        fn();
      }, ms);
    },
    clear() {
      clearTimeout(id);
      id = undefined;
    },
  };
}
