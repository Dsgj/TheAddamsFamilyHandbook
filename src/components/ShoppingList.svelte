<script lang="ts">
  import { onMount } from 'svelte';
  import { agree, KIND_PLURAL } from '~/lib/copy';
  import { componentKey } from '~/lib/model/key';
  import { canShare, copyText, shareText } from '~/lib/share';
  import { allStatuses, setStatus } from '~/lib/model/status.svelte';
  import { componentHref } from '~/lib/url';
  import {
    formatShopping,
    groupFaults,
    itemRef,
    KIND_ORDER,
    NO_PART,
    type ShoppingItem,
  } from '~/lib/shopping';

  /**
   * The Shopping list (spec §9.15): one group per kind, a header row per part with the count, and
   * one row per faulted component. Fixed clears the fault; a full swipe to the left on a row does
   * the same (an 88px pane reveals under the row while dragging). Copy as text, Share and Show
   * text act on the same export text.
   */
  let { items }: { items: ShoppingItem[] } = $props();

  const groups = $derived(groupFaults(items, allStatuses()));
  const text = $derived(formatShopping(groups));
  const total = $derived(groups.reduce((n, g) => n + g.items.length, 0));
  const kinds = $derived(KIND_ORDER.filter((k) => groups.some((g) => g.kind === k)));

  let show = $state(false);
  let fallback = $state(false);
  // Read after mount: navigator is not there at build time.
  let shareable = $state(false);
  onMount(() => {
    shareable = canShare();
  });

  /** Shows the text to select and copy by hand when nothing left the page. */
  function byHand(sent: boolean) {
    if (sent) return;
    fallback = true;
    show = true;
  }
  const copy = async () => byHand(await copyText(text));
  const share = async () => byHand(await shareText('Parts to order', text));
  function fixed(i: ShoppingItem) {
    setStatus(i.kind, i.id, '');
  }

  // Swipe: a mostly horizontal drag to the left moves the row over its pane; releasing past
  // the pane's width commits Fixed, anything shorter snaps back. Vertical drags scroll as usual.
  const PANE = 88;
  let drag = $state<{ key: string; dx: number } | null>(null);
  let start: { key: string; x: number; y: number; decided: boolean } | null = null;
  function key(i: ShoppingItem) {
    return componentKey(i.kind, i.id);
  }
  function down(e: PointerEvent, i: ShoppingItem) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { key: key(i), x: e.clientX, y: e.clientY, decided: false };
  }
  function move(e: PointerEvent) {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start = null;
        return;
      }
      start.decided = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    drag = { key: start.key, dx: Math.max(-PANE - 24, Math.min(0, dx)) };
  }
  function up(i: ShoppingItem) {
    if (drag && drag.key === key(i) && -drag.dx >= PANE) fixed(i);
    drag = null;
    start = null;
  }
  function cancel() {
    drag = null;
    start = null;
  }
</script>

{#if total === 0}
  <section class="empty card">
    <p>
      Nothing marked Fault yet. Tick Fault on the Switch matrix, Lamp matrix or Solenoids and
      flashers page, or set Fault on a component card.
    </p>
  </section>
{:else}
  <div class="bar">
    <p class="total">
      <span class="dmd">{total}</span>
      {agree(total, 'part')} to order
    </p>
    <div class="acts">
      <button type="button" class="btn sm" onclick={copy}>Copy as text</button>
      {#if shareable}<button type="button" class="btn sm" onclick={share}>Share</button>{/if}
      <button type="button" class="btn sm" aria-pressed={show} onclick={() => (show = !show)}>
        {show ? 'Hide text' : 'Show text'}
      </button>
    </div>
  </div>
  {#if show}
    <textarea class="field text mono" readonly rows={Math.min(14, text.split('\n').length + 1)}
      >{text}</textarea
    >
    {#if fallback}<p class="gf">Select all and copy.</p>{/if}
  {/if}

  {#each kinds as kind (kind)}
    <section class="grp">
      <h2 class="lst-h">{KIND_PLURAL[kind]}</h2>
      <ul class="lst">
        {#each groups.filter((g) => g.kind === kind) as g (g.label + g.part)}
          <li class="lrow static part">
            <span class="count">{g.items.length} ×</span>
            <span class="mono">{g.label}</span>
            {#if g.part !== NO_PART}<span class="muted">({g.part})</span>{/if}
          </li>
          {#each g.items as i (key(i))}
            {@const dx = drag?.key === key(i) ? drag.dx : 0}
            <li class="sw" class:armed={-dx >= PANE}>
              <div class="pane" aria-hidden="true">Fixed</div>
              <!-- svelte-ignore a11y_no_static_element_interactions (the swipe is a shortcut; the Fixed button is the keyboard and screen-reader path) -->
              <div
                class="lrow static row"
                style:transform={dx ? `translateX(${dx}px)` : undefined}
                class:dragging={!!dx}
                onpointerdown={(e) => down(e, i)}
                onpointermove={move}
                onpointerup={() => up(i)}
                onpointercancel={cancel}
              >
                <a class="lnk" href={componentHref(i.kind, i.id)} draggable="false">
                  <span class="code dmd id">{itemRef(i)}</span>
                  {i.name}
                  {#if i.note}<span class="note muted">{i.note}</span>{/if}
                </a>
                <button
                  type="button"
                  class="btn sm fix"
                  aria-label="Fixed: {i.name}"
                  onclick={() => fixed(i)}
                >
                  Fixed
                </button>
              </div>
            </li>
          {/each}
        {/each}
      </ul>
    </section>
  {/each}
  <p class="gf">Mark a component Fault and it lands here. Fixed clears the fault.</p>
{/if}

<style>
  .empty {
    margin: 0;
  }
  .empty p {
    margin: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px var(--gap);
    margin: 0 0 4px;
  }
  .total {
    margin: 0;
    font-size: 17px;
  }
  .total .dmd {
    font-size: 1.3em;
    margin-right: 4px;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  /* Size only, so the .mono face stays; 16 at least, or iOS zooms into the field (spec §8.7). */
  .text {
    width: 100%;
    margin: 8px 0 4px;
    white-space: pre;
  }
  .grp {
    margin-top: var(--gap);
  }
  .lst,
  .lst-h,
  .gf {
    margin-left: 0;
    margin-right: 0;
  }
  .part {
    min-height: 36px;
    padding-top: 8px;
    padding-bottom: 2px;
    gap: 6px;
    color: var(--muted);
    font-size: 15px;
  }
  .part .count {
    color: var(--ink);
    font-weight: 600;
  }
  .part .mono {
    color: var(--amber-ink);
  }
  .sw {
    position: relative;
    overflow: hidden;
  }
  /* Fixed is a good outcome, so the pane is the OK colour, not red (DS-09). The label sits at
     the pane's far edge, so the row uncovers it well before the armed point. */
  .pane {
    position: absolute;
    inset: 0 0 0 auto;
    display: grid;
    place-items: center end;
    width: 88px;
    padding-right: 14px;
    background: var(--ok);
    color: var(--on-amber);
    font-weight: 600;
    opacity: 0;
    transition: opacity var(--dur-0) var(--ease-standard);
  }
  .sw:has(.dragging) .pane {
    opacity: 1;
  }
  .sw.armed .pane {
    font-size: 1.1em;
  }
  .row {
    position: relative;
    background: var(--cell);
    padding-right: 8px;
    touch-action: pan-y;
    transition: transform var(--dur-2) var(--ease-standard);
    user-select: none;
    -webkit-user-select: none;
  }
  .row.dragging {
    transition: none;
  }
  .lnk {
    flex: 1;
    min-width: 0;
    display: block;
    /* 44 tall at least (audit AY-12): the 26 line box and 9 above and below. */
    min-height: var(--touch);
    padding: calc((var(--touch) - 26px) / 2) 0;
    color: var(--ink);
    font-size: 17px;
    line-height: 22px;
    text-decoration: none;
  }
  @media (hover: hover) {
    .lnk:hover {
      text-decoration: underline;
    }
  }
  .id {
    margin-right: 4px;
  }
  /* The note typed on the fault, under the name: what to order or fix (CR2-03). */
  .note {
    display: block;
    font: var(--t-cap);
    overflow-wrap: anywhere;
  }
  .fix {
    flex: 0 0 auto;
    min-height: 36px;
  }
</style>
