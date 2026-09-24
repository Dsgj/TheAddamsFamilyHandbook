<script lang="ts">
  import { PLAYFIELD } from '~/lib/data/positions';
  import type { Loc } from '~/lib/model/types';
  import { href } from '~/lib/url';

  /** Crops a 132×168 window of the playfield drawing around the first position, with a ring. */
  let { pos, size = 520 }: { pos: Loc[]; size?: number } = $props();

  const W = 132;
  const H = 168;
  const scale = $derived(size / PLAYFIELD.w);
  const mapH = $derived(PLAYFIELD.h * scale);
  const first = $derived(pos[0]);
  const cx = $derived(first ? first.x * size : size / 2);
  const cy = $derived(first ? first.y * mapH : mapH / 2);
  const ox = $derived(Math.max(0, Math.min(size - W, cx - W / 2)));
  const oy = $derived(Math.max(0, Math.min(mapH - H, cy - H / 2)));
  const src = href('assets/maps/playfield.png');
</script>

{#if first}
  <div class="mini" style:width="{W}px" style:height="{H}px" aria-hidden="true">
    <img
      class="scan"
      {src}
      alt=""
      style:width="{size}px"
      style:left="{-ox}px"
      style:top="{-oy}px"
      loading="lazy"
    />
    {#each pos as l, li (li)}
      <span class="ring" style:left="{l.x * size - ox}px" style:top="{l.y * mapH - oy}px"></span>
    {/each}
  </div>
{:else}
  <div class="mini none" style:width="{W}px" style:height="{H}px">
    <span class="muted small">Not on map</span>
  </div>
{/if}

<style>
  .mini {
    position: relative;
    overflow: hidden;
    border-radius: var(--r);
    border: 1px solid var(--line);
    background: var(--sunk);
    flex: 0 0 auto;
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
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border-radius: 50%;
    border: 2.5px solid var(--amber);
    background: color-mix(in srgb, var(--amber) 25%, transparent);
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.5),
      0 0 10px var(--amber-glow);
  }
</style>
