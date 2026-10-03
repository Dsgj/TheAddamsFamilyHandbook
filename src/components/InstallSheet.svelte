<script lang="ts">
  import { onMount } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import { listen } from '~/lib/events';
  import { canInstall, promptInstall } from '~/lib/install';

  /**
   * The Install sheet (spec §9.16): a medium modal sheet. "Install" shows the browser's own
   * prompt where `beforeinstallprompt` fired (Q22); elsewhere the button stays out and the footer
   * tells the iPhone route.
   */
  let { recede = '', onclose }: { recede?: string; onclose: () => void } = $props();

  let installable = $state(false);
  onMount(() => {
    const mark = () => (installable = canInstall());
    mark();
    return listen('installable', mark);
  });
  async function install() {
    if (await promptInstall()) onclose();
    installable = canInstall();
  }
  const POINTS = [
    'Opens without the browser bar',
    'Works with no signal',
    'Updates itself when you are online',
  ];
</script>

<BottomSheet label="Install the app" detent="medium" {recede} {onclose}>
  <div class="body">
    <p>
      Adds it to your home screen. It opens full screen, like an app, and works offline in the
      workshop.
    </p>
    <ul class="points">
      {#each POINTS as p (p)}
        <li>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10l4 4 8-8" /></svg>
          {p}
        </li>
      {/each}
    </ul>
    {#if installable}
      <button type="button" class="btn primary wide" data-autofocus onclick={install}>
        Install
      </button>
    {/if}
    <p class="gf">On iPhone: tap Share, then Add to Home Screen.</p>
  </div>
</BottomSheet>

<style>
  .body {
    padding: 4px 16px 16px;
    font: var(--t-sub);
  }
  .body p {
    margin: 0 0 12px;
  }
  .points {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
  }
  .points li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
  }
  .points svg {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    fill: none;
    stroke: var(--ok);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .wide {
    width: 100%;
    min-height: 48px;
    margin-bottom: 12px;
  }
  .gf {
    margin: 0;
  }
</style>
