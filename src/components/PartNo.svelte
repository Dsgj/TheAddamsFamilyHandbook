<script lang="ts">
  import { partPieces, partsHref } from '~/lib/parts';
  let { no }: { no: string } = $props();
  // Each number links to its row on the Parts page when the parts list carries it (audit DA2-08).
  const pieces = $derived(
    partPieces(no).map((text, i) => ({ text, to: i % 2 ? undefined : partsHref(text) })),
  );
</script>

{#each pieces as p, i (i)}{#if p.to}<a href={p.to}>{p.text}</a>{:else}{p.text}{/if}{/each}

<style>
  /* Spec §12: a 44 box centred on the number, inside the 44-tall row of a map sheet. The
     component page's two-line row anchors it to the number's bottom instead (ComponentDetail). */
  a {
    display: inline-block;
    position: relative;
  }
  a::after {
    content: '';
    position: absolute;
    inset: min(0px, (100% - var(--touch)) / 2);
  }
</style>
