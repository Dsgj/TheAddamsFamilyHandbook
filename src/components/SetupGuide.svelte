<script lang="ts">
  import type { SetupItem, SetupStep } from '~/data/setup';
  import { doneCount, getSetup, saveValue, setDone, setValue } from '~/lib/model/setup.svelte';
  import { shortDate } from '~/lib/status-io';

  let {
    steps,
    links,
    intro,
    warning,
    noun = 'settings',
  }: {
    steps: SetupStep[];
    /** Item id → handbook href, resolved at build time. */
    links: Record<string, string>;
    intro: string;
    warning: string;
    /** What the ticks count, for the progress line. */
    noun?: string;
  } = $props();

  const ids = $derived(steps.flatMap((s) => s.items.map((i) => i.id)));
  const done = $derived(doneCount(ids));
  const isCode = (id: string) => /^[AU]\.\d/.test(id);
  /** Spec §9.13, audit AY-10: an item as its controls name it. Names repeat ("Custom Message" is
   *  A.1 20 and U.5), so a coded item carries its code. */
  const refOf = (i: { id: string; name: string }) => (isCode(i.id) ? `${i.id} ${i.name}` : i.name);
  /** A unique id fragment per item, for the field's aria-labelledby. */
  const keyOf = (id: string) => id.replace(/[^a-z0-9]+/gi, '-');
  const isTask = (i: SetupItem) => !i.suggested;
  const stepDone = (s: SetupStep) => doneCount(s.items.map((i) => i.id));
</script>

<p class="muted intro">{intro}</p>
<p class="progress" role="status">
  <span class="dmd small">{done} / {ids.length}</span>
  <span class="muted">{noun} done</span>
  <progress max={ids.length} value={done} aria-label="Progress"></progress>
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
          {@const ref = refOf(i)}
          {@const key = keyOf(i.id)}
          <li class="item" class:done={cur?.done}>
            <label class="tick">
              <input
                type="checkbox"
                checked={cur?.done ?? false}
                aria-label="Done: {ref}"
                onchange={(e) => setDone(i.id, e.currentTarget.checked)}
              />
            </label>
            <div class="body">
              <div class="head">
                {#if isCode(i.id)}<span class="mono code">{i.id}</span>{/if}
                <span class="name">{i.name}</span>
                {#if links[i.id]}<a
                    class="small"
                    href={links[i.id]}
                    aria-label="{ref} in the handbook">handbook</a
                  >{/if}
              </div>
              {#if !isTask(i)}
                <div class="vals">
                  <span class="small muted">Suggested</span>
                  <button
                    type="button"
                    class="btn sm mono"
                    title="Use suggested value"
                    aria-label="{i.suggested}, suggested for {ref}"
                    onclick={() => setValue(i.id, i.suggested)}>{i.suggested}</button
                  >
                  <!-- The name keeps the visible "Set to" first (WCAG 2.5.3) and adds the item. -->
                  <label class="small muted set">
                    <span id="sg-set-{key}">Set to</span>
                    <span class="sr-only" id="sg-ref-{key}">{ref}</span>
                    <input
                      class="field mono"
                      type="text"
                      aria-labelledby="sg-set-{key} sg-ref-{key}"
                      value={cur?.value ?? ''}
                      placeholder={isCode(i.id) ? '' : 'number on display, value'}
                      oninput={(e) => setValue(i.id, e.currentTarget.value, { defer: true })}
                      onchange={() => saveValue()}
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
  /* The prose measure (spec §3.1) on the intro, the warning, the reasons and each step's own
     paragraphs (its intro and its closing note). */
  .intro,
  .warn,
  .why,
  .step > p {
    max-width: var(--measure);
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
    border-radius: var(--r-xs);
    color: var(--brass-ink);
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
  /* Rows are at least 44px tall with a 44px tick target (spec §8.3). */
  .item {
    display: grid;
    grid-template-columns: var(--touch) 1fr;
    gap: 4px;
    min-height: 44px;
    padding: 6px 0;
    border-top: 1px solid var(--line);
  }
  .tick {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    align-self: start;
    cursor: pointer;
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
  /* Spec §12: the "handbook" link sits beside the name, not in running text, so it is a real 44
     target; the head grows round it and the suggestion button below keeps its own area. */
  .head a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
  .code {
    color: var(--amber-ink);
  }
  /* The measure on the name only: a long one (the Thing Flips task) sets 60-80 a line, and the
     suggested value and the Set field below keep the row's width. */
  .name {
    font-weight: 500;
    max-width: var(--measure);
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
    /* 8 between rows too: a small button's 44 hit area reaches 4 past its box (spec §8.7). */
    gap: 8px;
    margin-top: 6px;
  }
  /* A long suggested value (U.5's custom message) wraps instead of widening the page at 320px. */
  .vals .btn {
    max-width: 100%;
    padding-block: 4px;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: left;
  }
  /* The label is the 44 target (it focuses the field); the field itself stays 34 (audit AY-12). */
  .set {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1 1 180px;
    min-height: 44px;
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
