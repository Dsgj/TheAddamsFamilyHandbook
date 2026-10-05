<script lang="ts">
  import { allPositions, PLAYFIELD, type PosKind } from '~/lib/data/positions';
  import type { Loc } from '~/lib/model/types';
  import { href } from '~/lib/url';

  /**
   * Crops a w×h window (132×168 by default) of the playfield drawing around the first position;
   * with `fluid` the window is as wide as its container, still centred on the part (VP3-08).
   * With `others`, the neighbours of that kind inside the window are drawn as labelled dots
   * (the Show-on-map sheet, spec §9.8); `ring` is the marker's diameter.
   */
  let {
    pos,
    size = 520,
    w: W = 132,
    h: H = 168,
    ring = 18,
    others,
    fluid = false,
  }: {
    pos: Loc[];
    size?: number;
    w?: number;
    h?: number;
    ring?: number;
    /** Draw the other components of this kind that fall inside the crop. */
    others?: { kind: PosKind; except: string };
    /** Fill the container's width; `w` then only bounds the neighbours drawn. */
    fluid?: boolean;
  } = $props();
  const scale = $derived(size / PLAYFIELD.w);
  const mapH = $derived(PLAYFIELD.h * scale);
  const first = $derived(pos[0]);
  const cx = $derived(first ? first.x * size : size / 2);
  const cy = $derived(first ? first.y * mapH : mapH / 2);
  // Centred on the part even at the drawing's edge, where the ground shows past it: a crop
  // clamped to the drawing showed an edge part as a blank corner with its ring cut (VL2-08).
  const ox = $derived(cx - W / 2);
  const oy = $derived(cy - H / 2);
  /** A crop x as a left offset: from the window's centre when the width is the container's. */
  const at = (x: number) => (fluid ? `calc(50% + ${x - W / 2}px)` : `${x}px`);
  const src = href('assets/maps/playfield.png');
  const neighbours = $derived.by(() => {
    if (!others) return [];
    const out: { id: string; x: number; y: number }[] = [];
    const prefix = `${others.kind}:`;
    for (const [key, locs] of Object.entries(allPositions())) {
      if (!key.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      if (id === others.except) continue;
      for (const l of locs) {
        const x = l.x * size - ox;
        const y = l.y * mapH - oy;
        if (x >= 0 && x <= W && y >= 0 && y <= H) out.push({ id, x, y });
      }
    }
    return out;
  });
</script>

{#if first}
  <div
    class="mini"
    class:fluid
    style:width={fluid ? null : `${W}px`}
    style:height="{H}px"
    aria-hidden="true"
  >
    <img
      class="scan"
      {src}
      alt=""
      style:width="{size}px"
      style:left={at(-ox)}
      style:top="{-oy}px"
      loading="lazy"
    />
    {#each neighbours as n (n.id + n.x)}
      <span class="dot mono" style:left={at(n.x)} style:top="{n.y}px">{n.id}</span>
    {/each}
    {#each pos as l, li (li)}
      <span
        class="ring"
        style:left={at(l.x * size - ox)}
        style:top="{l.y * mapH - oy}px"
        style:width="{ring}px"
        style:height="{ring}px"
        style:margin="{-ring / 2}px 0 0 {-ring / 2}px"
      ></span>
    {/each}
  </div>
{:else}
  <div class="mini none" class:fluid style:width={fluid ? null : `${W}px`} style:height="{H}px">
    <span class="muted small">Not on map</span>
  </div>
{/if}

<style>
  .mini {
    position: relative;
    overflow: hidden;
    max-width: 100%;
    border-radius: var(--r-btn);
    background: var(--sunk);
    box-shadow: inset 0 0 0 1px var(--sep);
    flex: 0 0 auto;
  }
  .mini.fluid {
    width: 100%;
  }
  .mini.none {
    display: grid;
    place-items: center;
  }
  img {
    position: absolute;
    max-width: none;
    height: auto;
  }
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 2.5px solid var(--amber);
    background: color-mix(in srgb, var(--amber) 25%, transparent);
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.5),
      0 0 10px var(--amber-glow);
  }
  .dot {
    position: absolute;
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 4px;
    transform: translate(-50%, -50%);
    border-radius: var(--r-full);
    background: var(--cell);
    color: var(--ink);
    font: var(--t-cap);
    box-shadow: 0 0 0 1px var(--sep);
  }
</style>
