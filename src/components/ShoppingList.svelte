<script lang="ts">
  import { allStatuses, setStatus } from '~/lib/model/status.svelte';
  import {
    formatShopping,
    groupFaults,
    itemRef,
    KIND_TITLE,
    type ShoppingItem,
  } from '~/lib/shopping';
  import { componentHref, href } from '~/lib/url';

  let { items }: { items: ShoppingItem[] } = $props();
  const groups = $derived(groupFaults(items, allStatuses()));
  const text = $derived(formatShopping(groups));
  const total = $derived(groups.reduce((n, g) => n + g.items.length, 0));
  const kinds = $derived([...new Set(groups.map((g) => g.kind))]);

  let copied = $state('');
  let textarea = $state<HTMLTextAreaElement | undefined>();
  let showText = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = 'Copied';
    } catch {
      showText = true;
      queueMicrotask(() => {
        textarea?.focus();
        textarea?.select();
        copied = 'Select all and copy';
      });
    }
    setTimeout(() => (copied = ''), 2000);
  }
</script>

{#if !groups.length}
  <section class="card empty">
    <p>
      Nothing marked Fault yet. Tick Broken on the <a href={href('lamps')}>Lamps</a>,
      <a href={href('switches')}>Switches</a> or <a href={href('coils')}>Solenoids</a> page.
    </p>
  </section>
{:else}
  <div class="bar">
    <span class="muted">{total} {total === 1 ? 'part' : 'parts'} to order</span>
    <button type="button" class="btn small" onclick={copy}>Copy as text</button>
    <button type="button" class="btn small" onclick={() => (showText = !showText)}>
      {showText ? 'Hide text' : 'Show text'}
    </button>
    {#if copied}<span class="ok small" role="status">{copied}</span>{/if}
  </div>
  {#if showText}
    <textarea class="field text mono" readonly rows="8" bind:this={textarea} value={text}
    ></textarea>
  {/if}
  {#each kinds as kind (kind)}
    <section class="card grp">
      <h2>{KIND_TITLE[kind]}</h2>
      {#each groups.filter((g) => g.kind === kind) as g (g.label + g.part)}
        <div class="group">
          <h3>
            <span class="count">{g.items.length} ×</span>
            <span class="mono">{g.label}</span>
            {#if g.part}<span class="muted mono small">({g.part})</span>{/if}
          </h3>
          <ul>
            {#each g.items as i (i.id)}
              <li>
                <a href={componentHref(i.kind, i.id)}
                  ><span class="mono id">{itemRef(i)}</span> {i.name}</a
                >
                <button
                  type="button"
                  class="btn small"
                  aria-label="Fixed: {i.name}"
                  onclick={() => setStatus(i.kind, i.id, '')}>Fixed</button
                >
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
  {/each}
{/if}

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: var(--gap);
  }
  .ok {
    color: var(--ok);
  }
  .text {
    width: 100%;
    margin-bottom: var(--gap);
    font-size: 0.8rem;
  }
  .grp {
    margin-bottom: var(--gap);
  }
  .group + .group {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  h3 {
    margin: 0 0 6px;
    font-size: 1rem;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .count {
    color: var(--amber);
    font-family: var(--font-display);
    font-size: 1.15rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
  }
  li a {
    color: var(--ink);
    text-decoration: none;
  }
  li a:hover {
    text-decoration: underline;
  }
  .id {
    color: var(--amber);
    margin-right: 4px;
  }
</style>
