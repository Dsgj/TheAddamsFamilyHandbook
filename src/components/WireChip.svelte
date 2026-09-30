<script lang="ts">
  import { wireBackground } from '~/lib/wire';
  let { colour, label }: { colour: string; label?: string } = $props();
</script>

<!-- A label, not a control: the global .wire (spec §8.6) has no background, no cursor and no
     height of its own, so it never reads as the interactive .chip. -->
<span class="wire" title={colour}>
  <i style:background={wireBackground(colour)}></i>
  <span>{label ?? colour}</span>
</span>
