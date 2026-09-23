<script lang="ts">
  import { wireBackground } from '~/lib/wire';
  let { colour, label }: { colour: string; label?: string } = $props();
</script>

<span class="chip" title={colour}>
  <i style:background={wireBackground(colour)}></i>
  <span>{label ?? colour}</span>
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 0.85em;
    white-space: nowrap;
  }
  i {
    display: inline-block;
    width: 26px;
    height: 10px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.35);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
  }
</style>
