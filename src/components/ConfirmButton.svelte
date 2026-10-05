<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { later } from '~/lib/later';

  /**
   * A destructive action that asks once more (UX2-08, CR-11): the first tap arms the button, which
   * then reads `confirm` in the danger colour; a second tap within 4 s runs `onconfirm`, else it
   * disarms. Diagnose's Clear (Recent) and Device data's Clear all are the two (AR3-10). `children`
   * wraps the text when the button is a list row; the plain button holds its text alone.
   */
  let {
    label,
    confirm,
    onconfirm,
    class: cls = '',
    disabled = false,
    children,
  }: {
    label: string;
    confirm: string;
    onconfirm: () => void;
    class?: string;
    disabled?: boolean;
    children?: Snippet<[string]>;
  } = $props();

  let armed = $state(false);
  const disarm = later();
  onDestroy(disarm.clear);
  function tap() {
    disarm.clear();
    if (!armed) {
      armed = true;
      disarm.set(() => (armed = false), 4000);
      return;
    }
    armed = false;
    onconfirm();
  }
  const text = $derived(armed ? confirm : label);
</script>

<button type="button" class={cls} class:armed onclick={tap} {disabled}>
  {#if children}{@render children(text)}{:else}{text}{/if}
</button>

<style>
  .armed {
    color: var(--bad);
  }
</style>
