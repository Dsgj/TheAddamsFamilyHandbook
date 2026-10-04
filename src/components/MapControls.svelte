<script lang="ts">
  import Icon from './Icon.svelte';
  import { KIND_PLURAL, LAYER_KIND } from '~/lib/copy';
  import type { MapLayer } from '~/lib/map/items';
  import { LABEL, LAYERS } from '~/lib/map/items';

  /**
   * The map's controls (spec §7.3–7.4, AR2-02): the layer toggles in their three forms, the zoom
   * readout and capsule and the keyboard legend. PlayfieldMap owns the state and says where they
   * go. `stage` floats over the drawing: the glass layers list, the readout and the capsule in the
   * corner from 1000, or one column of the layers capsule over the zoom capsule (`compact`).
   * `side` is the wide panel's row of toggles (`layers`) and the keys line (`keys`).
   */
  type Zoom = {
    readonly zoom: number;
    readonly zoomLabel: string;
    zoomIn: () => void;
    zoomOut: () => void;
    fitAll: () => void;
  };
  let {
    place,
    on,
    counts,
    toggle,
    zm,
    compact = false,
    glassInPanel = false,
    embed = false,
    legend = false,
    layers = false,
    keys = false,
    wide = false,
    sheet = false,
    gone = false,
  }: {
    place: 'stage' | 'side';
    on: ReadonlySet<MapLayer>;
    /** Parts per layer that have a position on the drawing. */
    counts: Record<MapLayer, number>;
    toggle: (l: MapLayer) => void;
    zm: Zoom;
    /** Stage: phones, tablets and a narrow embed (no glass list, no readout). */
    compact?: boolean;
    /** Stage: the layers sit in the panel, so the readout drops clear of the drawing. */
    glassInPanel?: boolean;
    /** Stage: the handbook's embed, where the readout is no live region. */
    embed?: boolean;
    /** Stage: the floating keyboard legend. */
    legend?: boolean;
    /** Side: the row of layer toggles. */
    layers?: boolean;
    /** Side: the keyboard shortcuts line. */
    keys?: boolean;
    wide?: boolean;
    /** Stage: the selection sheet is up (the column moves above it) or expanded (it fades). */
    sheet?: boolean;
    gone?: boolean;
  } = $props();

  /** Short labels for the wide layers list (ShellDesktop). LABEL names the layer buttons. */
  const shortName = (l: MapLayer) => (l === 'shot' ? 'Shots' : KIND_PLURAL[LAYER_KIND[l]]);
</script>

{#snippet layerIcon(l: MapLayer)}
  <svg class="ico k-{l}" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    {#if l === 'sw'}
      <circle cx="10" cy="10" r="6.5" />
    {:else if l === 'lamp'}
      <circle cx="10" cy="10" r="4" class="fill" />
      <circle cx="10" cy="10" r="7.5" />
    {:else if l === 'coil'}
      <rect x="3.5" y="3.5" width="13" height="13" rx="3.5" />
    {:else}
      <path d="M10 3.2 17 16.8H3z" />
    {/if}
  </svg>
{/snippet}

{#snippet zoomCapsule()}
  <div class="glass capsule zooms" role="group" aria-label="Zoom">
    <button class="ibtn sq" type="button" aria-label="Zoom in" onclick={zm.zoomIn}>
      <Icon name="plus" size={20} />
    </button>
    <button class="ibtn sq" type="button" aria-label="Zoom out" onclick={zm.zoomOut}>
      <Icon name="minus" size={20} />
    </button>
    <button
      class="ibtn sq fit"
      type="button"
      aria-label="Fit whole playfield"
      aria-disabled={zm.zoom <= 1 ? 'true' : undefined}
      onclick={zm.fitAll}
    >
      <Icon name="fit" size={20} />
    </button>
  </div>
{/snippet}

{#snippet keyHints()}
  <span><kbd>↑↓←→</kbd> markers</span>
  <span><kbd>⇧↑↓←→</kbd> pan</span>
  <span><kbd>⏎</kbd> select</span>
  <span><kbd>Esc</kbd> deselect</span>
  <span><kbd>+</kbd><kbd>−</kbd> zoom</span>
  <span><kbd>0</kbd> fit</span>
{/snippet}

{#if place === 'stage'}
  <div class="map-controls" class:wide class:sheet class:gone>
    {#if !compact}
      {#if !glassInPanel}
        <div class="glass layers-list" role="group" aria-label="Layers">
          {#each LAYERS as l (l)}
            <button
              class="lrow k-{l}"
              class:off={!on.has(l)}
              type="button"
              aria-pressed={on.has(l)}
              aria-label="{LABEL[l]}, {counts[l]} on the map"
              onclick={() => toggle(l)}
            >
              <span class="tile" aria-hidden="true">{@render layerIcon(l)}</span>
              <span class="lbl" aria-hidden="true">{shortName(l)}</span>
              <span class="mono cnt" aria-hidden="true">{counts[l]}</span>
            </button>
          {/each}
        </div>
      {/if}
      <div class="glass mono readout" class:low={glassInPanel} role={embed ? undefined : 'status'}>
        <span class="sr-only">Zoom level</span>{zm.zoomLabel}
      </div>
      <div class="corner">
        {@render zoomCapsule()}
      </div>
      {#if legend}
        <div class="glass legend" role="note" aria-label="Keyboard shortcuts">
          {@render keyHints()}
        </div>
      {/if}
    {:else}
      <div class="column">
        <div class="glass capsule layers" role="group" aria-label="Layers">
          {#each LAYERS as l (l)}
            <button
              class="ibtn sq k-{l}"
              class:off={!on.has(l)}
              type="button"
              aria-pressed={on.has(l)}
              aria-label={LABEL[l]}
              onclick={() => toggle(l)}
            >
              {@render layerIcon(l)}
            </button>
          {/each}
        </div>
        {@render zoomCapsule()}
      </div>
    {/if}
  </div>
{:else}
  {#if layers}
    <div class="layers-row" role="group" aria-label="Layers">
      {#each LAYERS as l (l)}
        <button
          class="ibtn sq k-{l}"
          class:off={!on.has(l)}
          type="button"
          aria-pressed={on.has(l)}
          aria-label="{LABEL[l]}, {counts[l]} on the map"
          onclick={() => toggle(l)}
        >
          {@render layerIcon(l)}<span class="lname" aria-hidden="true">{shortName(l)}</span>
        </button>
      {/each}
    </div>
  {/if}
  {#if keys}
    <p class="keys" role="note" aria-label="Keyboard shortcuts">{@render keyHints()}</p>
  {/if}
{/if}

<style>
  /* Floating controls (spec §7.3–7.4). */
  .map-controls {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: var(--z-map-controls);
  }
  .map-controls > *,
  .column {
    pointer-events: auto;
  }
  .column {
    position: absolute;
    right: 10px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 44px;
    transition:
      bottom var(--dur-3) var(--ease-emphasized),
      opacity var(--dur-1) var(--ease-standard),
      visibility 0s;
  }
  /* The sheet at peek: the column moves 12 above it; expanded, it fades out (120 ms). */
  .map-controls.sheet .column {
    bottom: calc(var(--sheet-peek) + 12px);
  }
  .map-controls.gone .column {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--dur-1) var(--ease-standard),
      visibility 0s var(--dur-1);
  }
  /* A phone on its side: the stage is too short for the column above the sheet at peek, which
     rose over the top bar, so the layers and the zoom capsule sit side by side (CR2-02). */
  @media (max-height: 560px) {
    .column {
      flex-direction: row;
      align-items: flex-end;
      width: auto;
    }
  }
  /* The layers toggles in the panel, where the gutter is too narrow to float them (spec §7.4):
     four equal toggles, each its glyph over its name (VL2-03). */
  .layers-row {
    justify-self: stretch;
    display: flex;
    gap: 4px;
  }
  .layers-row .ibtn {
    flex: 1 1 0;
    height: auto;
    min-height: 56px;
    gap: 2px;
    font: var(--t-cap);
  }
  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 0;
    font: var(--t-cap);
    color: var(--muted);
  }
  .capsule {
    display: flex;
    flex-direction: column;
    border-radius: var(--r-md);
  }
  .ibtn.off {
    color: var(--faint);
  }
  .ibtn.fit {
    color: var(--amber-ink);
  }
  .ibtn.fit[aria-disabled='true'] {
    color: var(--faint);
    cursor: default;
  }
  .ico {
    color: var(--k);
    fill: var(--k-fill);
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ico .fill {
    fill: var(--k);
  }
  .ibtn.off .ico {
    color: var(--faint);
    fill: none;
  }
  .layers-list {
    position: absolute;
    left: 16px;
    top: 16px;
    width: 164px;
    padding: 4px 0;
    border-radius: var(--r-md);
    display: grid;
  }
  .lrow {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 12px 0 6px;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    font: var(--t-sub);
  }
  .lrow:active {
    background: var(--press);
  }
  .lrow .tile {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-track);
    background: var(--k-fill);
  }
  .lrow.k-shot .tile {
    background: var(--sunk);
  }
  .lrow .lbl {
    flex: 1;
  }
  .lrow .cnt {
    font: var(--t-foot);
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--muted);
  }
  .lrow.off {
    color: var(--muted);
  }
  .lrow.off .tile {
    background: none;
  }
  .corner {
    position: absolute;
    right: 16px;
    bottom: 16px;
  }
  /* Beside the capsule when the glass floats; above it, clear of the drawing, when it does not. */
  .readout.low {
    right: 16px;
    bottom: 156px;
    width: 44px;
    padding: 0;
  }
  .readout {
    position: absolute;
    right: 68px;
    bottom: 68px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--r-md);
    display: grid;
    place-items: center;
    font: var(--t-cap);
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--ink);
  }
  /* The legend floats in the gutter only, so its entries stack in the list's 164. */
  .legend {
    position: absolute;
    left: 16px;
    bottom: 16px;
    padding: 10px 12px;
    border-radius: var(--r-btn);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 164px;
    font: var(--t-cap);
    color: var(--muted);
  }
  .legend span,
  .keys span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend kbd,
  .keys kbd {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 4px;
    border-radius: var(--r-xs);
    background: var(--sunk);
    color: var(--ink);
    font: var(--t-tab);
    font-family: var(--font-mono);
  }

  @media (prefers-reduced-motion: reduce) {
    .column {
      transition:
        opacity var(--dur-1) var(--ease-standard),
        visibility 0s;
    }
  }
</style>
