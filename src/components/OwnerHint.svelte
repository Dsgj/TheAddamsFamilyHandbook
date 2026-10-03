<script lang="ts">
  /**
   * The owner's hint on a switch and the note on a coil (AR2-01, CP2-03): one wording, with the
   * provenance tag, on the card, the detail page and the map's phone sheet (DS-13). The look is
   * base.css `.hint`; `at` only sets where it sits.
   */
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
  <p class="hint in-{at}">
    <strong>Owner's hint</strong><br />
    {hint} <em>(owner's experience, not the manual)</em>
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
