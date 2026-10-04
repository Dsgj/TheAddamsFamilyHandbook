<script lang="ts">
  import { ICONS } from '~/lib/icons';
  import type { IconName } from '~/lib/icons';

  /**
   * One icon from icons.ts (DS3-06, AR3-14): the stroked svg the CSS already sizes and colours
   * (`.lrow .tile svg`, `.lrow .chev`, `.ibtn svg`), decorative, so hidden from the tree. `size`
   * sets width and height where no CSS does.
   */
  let { name, class: cls, size }: { name: IconName; class?: string; size?: number } = $props();
  const icon = $derived(ICONS[name]);
</script>

<svg class={cls} viewBox="0 0 {icon.box} {icon.box}" width={size} height={size} aria-hidden="true">
  <path d={icon.d} />
</svg>
