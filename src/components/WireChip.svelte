<script lang="ts">
  import { wireBackground, wireName } from '~/lib/wire';
  let { colour, label }: { colour: string; label?: string } = $props();
  // The full name in UK spelling (spec §13); the tooltip keeps the manual's abbreviation
  // ("Vio-Brn") and is dropped when it would only repeat the text or its US spelling.
  const text = $derived(label ?? wireName(colour));
  const tip = $derived(colour.replace(/Gray/g, 'Grey') === text ? undefined : colour);
</script>

<!-- A label, not a control: the global .wire (spec §8.6) has no background, no cursor and no
     height of its own, so it never reads as the interactive .chip. -->
<span class="wire" title={tip}>
  <i style:background={wireBackground(colour)}></i>
  <span>{text}</span>
</span>
