<script lang="ts">
  import { appendixAnchor } from '~/data/appendix';
  import { parseCodes, type ParsedCode } from '~/lib/codes';
  import { DATA, find, KIND_LABEL } from '~/lib/data/components';
  import type { Lamp, Switch } from '~/lib/model/types';
  import { lampSharedCauses, sharedCauses } from '~/lib/shared-cause';
  import { href } from '~/lib/url';
  import { untrack } from 'svelte';
  import ComponentCard from './ComponentCard.svelte';

  let { initial = '' }: { initial?: string } = $props();
  let input = $state(untrack(() => initial));

  $effect(() => {
    const q = new URLSearchParams(location.search).get('q');
    if (q && !input) input = q;
  });

  const parsed = $derived(parseCodes(input));
  const resolved = $derived(
    parsed.map((p) => ({ ...p, item: p.kind === 'unknown' ? undefined : find(p.kind, p.id) })),
  );
  const found = $derived(resolved.filter((r) => r.item));
  const missing = $derived(resolved.filter((r) => !r.item));
  const switches = $derived(found.filter((r) => r.kind === 'switch').map((r) => r.item as Switch));
  const lamps = $derived(found.filter((r) => r.kind === 'lamp').map((r) => r.item as Lamp));
  const causes = $derived([
    ...sharedCauses(switches, DATA.swCols, DATA.swRows),
    ...lampSharedCauses(lamps, DATA.lCols, DATA.lRows),
  ]);
  const shownMissing = $derived(missing.slice(0, 6));

  const examples = ['32 68 F1 F3', 'Check Switch 32', 'L11 L12 L13', 'SOL 7'];
  const label = (p: ParsedCode) => (p.kind === 'unknown' ? p.raw : `${KIND_LABEL[p.kind]} ${p.id}`);
</script>

<section class="diag">
  <label class="lbl" for="codes">Test report or display message</label>
  <div class="row">
    <textarea
      id="codes"
      class="field mono"
      rows="1"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      placeholder="32 68 F1 F3"
      bind:value={input}
    ></textarea>
    {#if input}
      <button class="btn" type="button" onclick={() => (input = '')}>Clear</button>
    {/if}
  </div>
  <p class="muted small">
    Switch numbers as printed in T.1/T.2 or in a Check Switch message, L55 for a lamp, SOL 7 or C07
    for a solenoid. A whole Test Report can be pasted as is. Try:
    {#each examples as e, i (e)}
      <button class="link" type="button" onclick={() => (input = e)}>{e}</button>{i <
      examples.length - 1
        ? ' · '
        : ''}
    {/each}
  </p>

  {#if missing.length}
    <p class="prov">
      Not recognised: {shownMissing.map((m) => label(m)).join(', ')}{missing.length >
      shownMissing.length
        ? ` and ${missing.length - shownMissing.length} more`
        : ''}. Matrix switches are 11–88, dedicated D1–D8, flipper F1–F8, lamps L11–L88, solenoids
      SOL 1–28.
    </p>
  {/if}

  {#if causes.length}
    <div class="card causes">
      <h2>Shared cause?</h2>
      <ul>
        {#each causes as c (c.matrix + c.kind + c.key)}
          <li class:eos={c.eos}>
            <span class="dmd small"
              >{c.kind === 'independent'
                ? `${c.matrix === 'lamp' ? 'LAMPS ' : ''}INDEPENDENT`
                : `${c.matrix === 'lamp' ? 'lamp ' : ''}${c.kind} ${c.key}`}</span
            >
            {c.text}
            {#if c.kind === 'column' || c.kind === 'row'}
              · <a href={href(c.matrix === 'lamp' ? 'lamps' : 'switches')}>matrix</a>
            {/if}
            {#if c.appendix}
              · <a href={href(`handbook/appendix#${appendixAnchor(c.appendix)}`)}>{c.appendix}</a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="cards">
    {#each found as r (r.kind + r.id)}
      {#if r.item && r.kind !== 'unknown'}
        <ComponentCard
          kind={r.kind}
          item={r.item}
          mapMeta={DATA.maps[r.kind === 'switch' ? 'sw' : r.kind]}
        />
      {/if}
    {/each}
  </div>
</section>

<style>
  .lbl {
    display: block;
    font-weight: 500;
    margin-bottom: 6px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row .field {
    font-size: 1.15rem;
    letter-spacing: 0.06em;
    flex: 1;
    resize: vertical;
    min-height: var(--touch);
    field-sizing: content;
    max-height: 40vh;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--amber);
    font-family: var(--font-mono);
    cursor: pointer;
  }
  .causes {
    margin: 12px 0;
  }
  .causes ul {
    margin: 0;
    padding-left: 0;
    list-style: none;
  }
  .causes li {
    margin: 8px 0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .causes li.eos {
    border-left: 3px solid var(--warn);
    padding-left: 10px;
  }
  .dmd.small {
    font-size: 0.72rem;
    padding: 3px 8px;
  }
  .cards {
    display: grid;
    gap: var(--gap);
    margin-top: 12px;
  }
  @media (min-width: 1000px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
