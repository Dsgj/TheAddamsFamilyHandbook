<script lang="ts">
  import type { SetupItem, SetupStep } from '~/data/setup';
  import { doneCount, getSetup, setDone, setValue } from '~/lib/model/setup.svelte';
  import { shortDate } from '~/lib/status-io';

  let {
    steps,
    links,
    intro,
    warning,
  }: {
    steps: SetupStep[];
    /** Item id → handbook href, resolved at build time. */
    links: Record<string, string>;
    intro: string;
    warning: string;
  } = $props();

  const ids = steps.flatMap((s) => s.items.map((i) => i.id));
  const done = $derived(doneCount(ids));
  const isCode = (id: string) => /^[AU]\.\d/.test(id);
  const isTask = (i: SetupItem) => !i.suggested;
  const stepDone = (s: SetupStep) => doneCount(s.items.map((i) => i.id));
</script>

<p class="muted">{intro}</p>
<p class="progress" role="status">
  <span class="dmd small">{done} / {ids.length}</span>
  <span class="muted">settings done</span>
  <progress max={ids.length} value={done} aria-label="Setup progress"></progress>
</p>
<p class="prov warn">{warning}</p>

<ol class="steps">
  {#each steps as s, n (s.id)}
    <li class="card step" id="step-{s.id}">
      <header>
        <h2><span class="n">{n + 1}</span> {s.title}</h2>
        <span class="mono small menu">{s.menu}</span>
        <span class="muted small">{stepDone(s)} / {s.items.length}</span>
      </header>
      <p class="muted small">{s.intro}</p>
      <ul class="items">
        {#each s.items as i (i.id)}
          {@const cur = getSetup(i.id)}
          <li class="item" class:done={cur?.done}>
            <label class="tick">
              <input
                type="checkbox"
                checked={cur?.done ?? false}
                aria-label="Done: {i.name}"
                onchange={(e) => setDone(i.id, e.currentTarget.checked)}
              />
            </label>
            <div class="body">
              <div class="head">
                {#if isCode(i.id)}<span class="mono code">{i.id}</span>{/if}
                <span class="name">{i.name}</span>
                {#if links[i.id]}<a class="small" href={links[i.id]}>handbook</a>{/if}
              </div>
              {#if !isTask(i)}
                <div class="vals">
                  <span class="small muted">Suggested</span>
                  <button
                    type="button"
                    class="btn small mono"
                    title="Use suggested value"
                    onclick={() => setValue(i.id, i.suggested)}>{i.suggested}</button
                  >
                  <label class="small muted set">
                    Set to
                    <input
                      class="field mono"
                      type="text"
                      value={cur?.value ?? ''}
                      placeholder={isCode(i.id) ? '' : 'number on display, value'}
                      onchange={(e) => setValue(i.id, e.currentTarget.value)}
                    />
                  </label>
                </div>
              {/if}
              {#if i.why}<p class="why small">{i.why}</p>{/if}
              {#if i.alt}<p class="why small muted">{i.alt}</p>{/if}
              {#if cur?.at}<p class="small muted when">
                  {cur.done ? 'done' : 'set'}
                  {shortDate(cur.at)}
                </p>{/if}
            </div>
          </li>
        {/each}
      </ul>
      {#if s.after}<p class="prov">{s.after}</p>{/if}
    </li>
  {/each}
</ol>

<style>
  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  progress {
    flex: 1 1 160px;
    height: 8px;
    accent-color: var(--ok);
  }
  .warn {
    border-left: 3px solid var(--warn);
    padding-left: 10px;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .step {
    margin-top: var(--gap);
  }
  .step header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 14px;
  }
  .step h2 {
    margin: 0;
  }
  .n {
    display: inline-block;
    min-width: 1.6em;
    text-align: center;
    border: 1px solid var(--brass);
    border-radius: var(--r);
    color: var(--brass);
    font-size: 0.8em;
    margin-right: 4px;
  }
  .menu {
    color: var(--violet);
  }
  .items {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .item {
    display: grid;
    grid-template-columns: var(--touch) 1fr;
    gap: 4px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .tick {
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }
  .tick input {
    width: 22px;
    height: 22px;
    accent-color: var(--ok);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .code {
    color: var(--amber);
  }
  .name {
    font-weight: 500;
  }
  .done .name {
    color: var(--muted);
    text-decoration: line-through;
    text-decoration-color: var(--ok);
  }
  .vals {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    margin-top: 6px;
  }
  .set {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1 1 180px;
  }
  .set .field {
    flex: 1;
    min-height: 34px;
    padding: 4px 10px;
  }
  .why {
    margin: 6px 0 0;
  }
  .when {
    margin: 2px 0 0;
  }
</style>
