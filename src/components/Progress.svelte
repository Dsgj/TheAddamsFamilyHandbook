<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  /** The checklists' one progress line (VP2-05): Setup, Care and Verify show the count on a DMD
   *  chip, what it counts, and a bar. Verify renders it on the server and its script keeps the
   *  numbers current (verify-check.ts). */
  let {
    done,
    total,
    what,
    ...rest
  }: {
    done: number;
    total: number;
    /** What the ticks count, after the chip: "settings done", "verified". */
    what: string;
  } & HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p class="progress" role="status" {...rest}>
  <span class="dmd small">{done} of {total}</span>
  <span class="muted">{what}</span>
  <progress max={total} value={done} aria-label="Progress"></progress>
</p>

<style>
  /* The measure, as on /verify where the line is a .wrap > p: Setup and Care render it inside an
     island, and it ran the full column there (VL3-10). */
  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    max-width: var(--measure);
  }
  /* 140, not 160: "47 of 47 settings done" and the bar share one line at 412 (spec §13). */
  progress {
    flex: 1 1 140px;
    height: 8px;
    accent-color: var(--ok);
  }
</style>
