/**
 * The key that names one component wherever the app keys by component: the status store, the
 * playfield positions, the map's selection and `id` parameter, the shopping list and the code
 * parser (audit AR2-14). `switch:32`, `coil:01`, `shot:3`. Ids carry no colon, so the first colon
 * splits a key.
 */
export function componentKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** A key's kind and id (the id may be empty); null without a kind before a colon. */
export function parseComponentKey(key: string): { kind: string; id: string } | null {
  const i = key.indexOf(':');
  return i > 0 ? { kind: key.slice(0, i), id: key.slice(i + 1) } : null;
}
