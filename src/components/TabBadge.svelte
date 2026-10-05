<script lang="ts">
  /**
   * The Workshop tab's badge (spec §6.2) and the sidebar's Shopping-list count pill (§6.4). Both
   * count the rows the Shopping list would show: every component marked Fault that has an
   * orderable entry (the same count the Workshop hub shows), read from the status store so a Fault
   * marked on the page updates the badge live. Nothing renders until the count is known on the
   * device, and nothing renders at 0. The badge is `aria-hidden`; the link's name carries the count
   * ("Workshop, 4 on the shopping list"). The pill is plain text with sr-only words, never a status.
   */
  import { onMount } from 'svelte';
  import { agree } from '~/lib/copy';
  import { allStatuses } from '~/lib/model/status.svelte';
  import { faultCount, shopKeys } from '~/lib/shop-keys';

  let { pill = false }: { pill?: boolean } = $props();

  let hydrated = $state(false);
  let host = $state<HTMLElement | null>(null);

  /** `kind:id` of every component the list can show, from the shell's JSON script (shop-keys.ts). */
  let known = $state(new Set<string>());
  const count = $derived(hydrated ? faultCount(known, allStatuses()) : 0);

  onMount(() => {
    known = shopKeys();
    hydrated = true;
  });

  $effect(() => {
    if (pill || !host) return;
    const link = host.closest('a');
    if (!link) return;
    if (count) link.setAttribute('aria-label', `Workshop, ${count} on the shopping list`);
    else link.removeAttribute('aria-label');
  });
</script>

{#if pill}
  {#if count}
    <!-- "1 part to order", "2 parts to order": the noun agrees with the count (spec §13). -->
    <span class="cnt"
      >{count}<span class="sr-only">{` ${agree(count, 'part')} to order`}</span></span
    >
  {/if}
{:else}
  <span class="badge-host" bind:this={host} aria-hidden="true">
    {#if count}<span class="badge" aria-hidden="true">{count}</span>{/if}
  </span>
{/if}

<style>
  .badge-host {
    display: contents;
  }
</style>
