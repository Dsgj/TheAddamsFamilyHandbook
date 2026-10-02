import type { ComponentStatus, Kind } from './model/types';
import { componentCode, KIND_PLURAL } from '~/lib/copy';
import { DATA } from '~/lib/data/components';

/** Compact per-component row the Shopping list island receives (keeps components.json out of the bundle). */
export interface ShoppingItem {
  kind: Kind;
  id: string;
  name: string;
  /** Orderable part number: bulbPart for lamps, part for switches and coils. */
  part: string;
  /** Bulb type (#555 / #44 / #906) for lamps, empty otherwise. */
  bulb: string;
  assy: string;
}

export interface ShoppingGroup {
  kind: Kind;
  /** Bulb type for lamps, part number for the rest. */
  label: string;
  /** Secondary reference shown in brackets: bulbPart for lamps, assembly for the rest. */
  part: string;
  items: ShoppingItem[];
}

export const NO_PART = 'no part number';
export const KIND_ORDER: Kind[] = ['lamp', 'switch', 'coil'];
/** The component's code as the tables print it: "32", "L55", "SOL 01" (spec §13). */
export const itemRef = (i: ShoppingItem) => componentCode(i.kind, i.id);

function groupKey(i: ShoppingItem): [label: string, part: string] {
  if (i.kind === 'lamp') return [i.bulb || NO_PART, i.part];
  return [i.part || NO_PART, i.assy];
}

/** Every item whose status is Fault, grouped by orderable part, lamps first, biggest groups first. */
export function groupFaults(items: ShoppingItem[], statuses: ComponentStatus[]): ShoppingGroup[] {
  const faulty = new Set(statuses.filter((s) => s.status === 'fault').map((s) => s.id));
  const groups = new Map<string, ShoppingGroup>();
  for (const i of items) {
    if (!faulty.has(`${i.kind}:${i.id}`)) continue;
    const [label, part] = groupKey(i);
    const key = `${i.kind}|${label}|${part}`;
    const g = groups.get(key) ?? { kind: i.kind, label, part, items: [] };
    g.items.push(i);
    groups.set(key, g);
  }
  const cmp = new Intl.Collator('en', { numeric: true }).compare;
  return [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => cmp(a.id, b.id)) }))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        b.items.length - a.items.length ||
        cmp(a.label, b.label),
    );
}

export function formatGroup(g: ShoppingGroup): string {
  const ref = g.part ? `${g.label} (${g.part})` : g.label;
  return `${g.items.length} × ${ref}: ${g.items.map((i) => `${itemRef(i)} ${i.name}`).join(', ')}`;
}

/** Plain text for the clipboard: a heading per kind, one line per group. */
export function formatShopping(groups: ShoppingGroup[]): string {
  const out: string[] = [];
  for (const kind of KIND_ORDER) {
    const gs = groups.filter((g) => g.kind === kind);
    if (!gs.length) continue;
    if (out.length) out.push('');
    out.push(KIND_PLURAL[kind], ...gs.map(formatGroup));
  }
  return out.join('\n');
}

/** Every lamp, switch and solenoid as a shopping candidate; the status store says which are faults. */
export function allShoppingItems(): ShoppingItem[] {
  return [
    ...DATA.lamps.map((l) => ({
      kind: 'lamp' as const,
      id: l.id,
      name: l.name,
      part: l.bulbPart,
      bulb: l.bulb,
      assy: l.assy,
    })),
    ...DATA.switches.map((s) => ({
      kind: 'switch' as const,
      id: s.id,
      name: s.name,
      part: s.part,
      bulb: '',
      assy: s.assy,
    })),
    ...DATA.coils.map((c) => ({
      kind: 'coil' as const,
      id: c.id,
      name: c.name,
      part: c.part,
      bulb: '',
      assy: c.assy,
    })),
  ];
}
