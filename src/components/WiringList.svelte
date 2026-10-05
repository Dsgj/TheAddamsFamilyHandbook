<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { WiringRow } from '~/lib/present';
  import { href } from '~/lib/url';
  import PartNo from './PartNo.svelte';
  import WireChip from './WireChip.svelte';

  /**
   * A component's wiring (audit AR2-01, SV2-08): the rows of present.ts `wiringRows`, as a `dl` on
   * the card and the detail page and as the map sheet's `list`. `links` makes the part numbers
   * links to the Parts page, where the rows are far enough apart for a 44 box each (spec §12).
   * `children` adds rows after them (the card's Callout), styled as this list's own.
   */
  let {
    rows,
    variant,
    links = false,
    card = false,
    children,
  }: {
    rows: WiringRow[];
    variant: 'dl' | 'list';
    links?: boolean;
    /** The detail page's list stands on its own, as a card (surfaces.css .card). */
    card?: boolean;
    children?: Snippet;
  } = $props();

  const DERIVED = '(derived from the fuse list, not printed per coil)';
</script>

{#snippet partNo(no: string)}{#if links}<PartNo {no} />{:else}{no}{/if}{/snippet}

{#if variant === 'dl'}
  <dl class="wiring" class:card>
    {#each rows as r (r.label)}
      <dt>{r.label}</dt>
      {#if r.kind === 'wire'}
        <dd><WireChip colour={r.wire.colour} /> <span class="mono">{r.wire.text}</span></dd>
      {:else if r.kind === 'part' && r.code}
        <dd><span class="mono">{r.code}</span> · {@render partNo(r.no)}</dd>
      {:else if r.kind === 'part'}
        <dd class="mono">{@render partNo(r.no)}</dd>
      {:else if r.kind === 'led'}
        <dd class="mono">{r.text}</dd>
      {:else}
        <dd>
          <a href={href(`fuses#${r.key}`)}>{r.text}</a>
          {#if r.derived}<span class="muted small">{DERIVED}</span>{/if}
        </dd>
      {/if}
    {/each}
    {@render children?.()}
  </dl>
{:else}
  <ul class="wires">
    {#each rows as r (r.label)}
      <li>
        <span class="lbl">{r.label}</span>
        {#if r.kind === 'wire'}
          <span class="mono muted wire"><WireChip colour={r.wire.colour} />{r.wire.text}</span>
        {:else if r.kind === 'part'}
          <span class="mono muted">{r.code ? `${r.code} · ` : ''}{@render partNo(r.no)}</span>
        {:else if r.kind === 'led'}
          <span class="mono muted">{r.text}</span>
        {:else if r.derived}
          <span class="val">
            <a class="mono" href={href(`fuses#${r.key}`)}>{r.text}</a>
            <span class="muted small">{DERIVED}</span>
          </span>
        {:else}
          <a class="mono" href={href(`fuses#${r.key}`)}>{r.text}</a>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* The card and the detail page (spec §8.5, §9.7). `:global` for the rows a caller adds. */
  .wiring {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin: 0;
    font: var(--t-sub);
  }
  .wiring :global(dt) {
    color: var(--muted);
  }
  .wiring :global(dd) {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
  }
  .wiring :global(dd .mono) {
    font-size: 12px;
    line-height: 16px;
  }
  /* Spec §12: a fuse or page link (20 tall) gets a 44 box centred on it. On the card it reaches
     12 of the 14 gap below the list, where no other target sits; on the detail page, the card's
     padding. */
  .wiring :global(dd a) {
    position: relative;
  }
  .wiring :global(dd a::after) {
    content: '';
    position: absolute;
    inset: min(0px, (100% - var(--touch)) / 2);
  }
  /* The map's phone sheet (spec §7.6): one 44 row per value, the label first and the value to
     the right, the card's order (VP3-03). */
  .wires {
    list-style: none;
    margin: 0 16px;
    padding: 0;
    border-radius: var(--r-md);
    background: var(--sheet-cell);
    overflow: hidden;
  }
  .wires li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 12px;
    font-size: 15px;
  }
  .wires li + li {
    border-top: 1px solid var(--sep);
  }
  .wires .lbl {
    color: var(--muted);
  }
  .wires .mono {
    margin-left: auto;
    font-size: 13px;
    text-align: right;
  }
  /* A wire's value: its chip and its colour, together at the right. */
  .wires .wire {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  /* A derived fuse: the link over its caption, both to the right. */
  .wires .val {
    margin-left: auto;
    text-align: right;
  }
  .wires .val .small {
    display: block;
  }
</style>
