<script lang="ts">
  /**
   * The owner's hint on a switch and the note on a coil (AR2-01, CP2-03): one wording, with the
   * provenance tag, on the card, the detail page and the map's phone sheet (DS-13). The tag follows
   * the hint's source (copy.ts hintSource): a hint that is the manual's own text is not tagged as
   * the owner's experience (CP3-01). The look is controls.css `.hint`; `at` only sets where it sits.
   */
  import { hintSource } from '~/lib/copy';

  let {
    hint,
    note,
    at,
  }: {
    hint?: string | undefined;
    note?: string | undefined;
    at: 'card' | 'detail' | 'sheet';
  } = $props();
</script>

{#if hint}
  {@const manual = hintSource(hint) === 'manual'}
  <p class="hint in-{at}">
    <strong>{manual ? 'From the manual' : "Owner's hint"}</strong><br />
    {hint}
    <em
      >{manual
        ? "(the manual's own pages and parts lists, not the owner's experience)"
        : "(owner's experience, not the manual)"}</em
    >
  </p>
{/if}
{#if note}
  <p class="hint in-{at}">{note}</p>
{/if}

<style>
  /* In the card's grid, whose gap spaces it. */
  .hint.in-card {
    margin: 0;
  }
  /* Under the Location list, at the prose measure (spec §3.1). */
  .hint.in-detail {
    margin: 10px 0 0;
    max-width: var(--measure);
  }
  .hint.in-sheet {
    margin: 12px 16px 0;
  }
</style>
