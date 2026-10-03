import type { ComponentStatus, Kind } from './model/types';
import { componentCode, KIND_PLURAL } from '~/lib/copy';
import { componentKey } from '~/lib/model/key';

/** Compact per-component row the Shopping list island receives (keeps components.json out of the bundle). */
export interface ShoppingItem {
  kind: Kind;
  id: string;
  name: string;
  /** Orderable part number: bulbPart for lamps, part for switches and coils. */
  part: string;
  /** Bulb type (#555 / #44 / #906) for lamps, empty otherwise. */
  bulb: string;
  /** The LED installed in this machine for lamps (what to order), empty otherwise. */
  led: string;
  assy: string;
}

/** A faulted item on the list, with the note the owner typed on its status (CR2-03). */
export interface ShoppingRow extends ShoppingItem {
  note: string;
}

export interface ShoppingGroup {
  kind: Kind;
  /** Installed LED (or bulb type when none is recorded) for lamps, part number for the rest. */
  label: string;
  /** Secondary reference shown in brackets: bulb type and bulbPart for lamps, assembly for the rest. */
  part: string;
  items: ShoppingRow[];
}

export const NO_PART = 'no part number';
export const KIND_ORDER: Kind[] = ['lamp', 'switch', 'coil'];
/** The component's code as the tables print it: "32", "L55", "SOL 01" (spec §13). */
export const itemRef = (i: ShoppingItem) => componentCode(i.kind, i.id);

function groupKey(i: ShoppingItem): [label: string, part: string] {
  if (i.kind === 'lamp') {
    if (i.led) return [i.led, [i.bulb, i.part].filter(Boolean).join(' · ')];
    return [i.bulb || NO_PART, i.part];
  }
  return [i.part || NO_PART, i.assy];
}

/** Every item whose status is Fault, grouped by orderable part, lamps first, biggest groups first. */
export function groupFaults(items: ShoppingItem[], statuses: ComponentStatus[]): ShoppingGroup[] {
  const faulty = new Map(
    statuses.filter((s) => s.status === 'fault').map((s) => [s.id, s.note.trim()]),
  );
  const groups = new Map<string, ShoppingGroup>();
  for (const i of items) {
    const note = faulty.get(componentKey(i.kind, i.id));
    if (note === undefined) continue;
    const [label, part] = groupKey(i);
    const key = `${i.kind}|${label}|${part}`;
    const g = groups.get(key) ?? { kind: i.kind, label, part, items: [] };
    g.items.push({ ...i, note });
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

/** "2 × #555 (24-8768): L11 Thing Multiball (socket loose), L12 Left Ramp": a note in brackets. */
export function formatGroup(g: ShoppingGroup): string {
  const ref = g.part ? `${g.label} (${g.part})` : g.label;
  const item = (i: ShoppingRow) => `${itemRef(i)} ${i.name}` + (i.note ? ` (${i.note})` : '');
  return `${g.items.length} × ${ref}: ${g.items.map(item).join(', ')}`;
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
