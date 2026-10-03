<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * The toast host (spec §8.8), mounted once in Base.astro. pwa.ts (and the tests) dispatch
   * `tafh:toast` on window with `{ kind: 'offline' | 'update' | 'info', text }`. One toast at a
   * time: Update ready wins over everything and stays until Reload; the others leave after 4 s.
   * The host is a plain aria-live region (never `role=status`: /care, /setup and /shopping run a
   * strict `getByRole('status')`) and passes pointer events through; only Reload takes them.
   * It sits 10 above the tab bar, lifted by --toast-lift over a reader toolbar (ReaderBar), the
   * map's sheet (BottomSheet) or the Diagnose dock, and under a modal sheet, which makes it inert
   * (spec §4, §8.8).
   */
  type Kind = 'offline' | 'update' | 'info';
  interface Toast {
    kind: Kind;
    text: string;
  }
  const DWELL = 4000;
  let toast = $state<Toast | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function show(t: Toast) {
    if (toast?.kind === 'update' && t.kind !== 'update') return;
    clearTimeout(timer);
    toast = t;
    if (t.kind !== 'update') timer = setTimeout(() => (toast = null), DWELL);
  }
  function reload() {
    window.dispatchEvent(new CustomEvent('tafh:reload'));
  }
  onMount(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Partial<Toast>>).detail;
      if (d && typeof d.text === 'string')
        show({ kind: d.kind === 'update' || d.kind === 'offline' ? d.kind : 'info', text: d.text });
    };
    window.addEventListener('tafh:toast', on);
    // An Update ready dispatched before this host hydrated (PF2-03).
    if (window.tafhToast) show(window.tafhToast);
    return () => {
      window.removeEventListener('tafh:toast', on);
      clearTimeout(timer);
    };
  });
</script>

<div class="toast-host" aria-live="polite" aria-atomic="true">
  {#if toast}
    <div class="toast" data-kind={toast.kind}>
      <span class="text">{toast.text}</span>
      {#if toast.kind === 'update'}
        <button type="button" class="btn sm primary" onclick={reload}>Reload</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .toast-host {
    position: fixed;
    z-index: var(--z-toast);
    left: calc(var(--shell-w) + 12px);
    right: 12px;
    bottom: calc(var(--tabbar-h) + var(--safe-bot) + 10px + var(--toast-lift, 0px));
    display: grid;
    justify-items: center;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(100%, 520px);
    min-height: 56px;
    padding: 10px 10px 10px 14px;
    border-radius: var(--r-md);
    background: var(--raised);
    box-shadow:
      var(--shadow-2),
      inset 0 0 0 1px var(--sep);
    color: var(--ink);
    font: var(--t-sub);
    animation: toast-in var(--dur-2) var(--ease-standard);
  }
  .toast .text {
    flex: 1;
  }
  .toast .btn {
    pointer-events: auto;
    flex: 0 0 auto;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    @keyframes toast-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }
  @media print {
    .toast-host {
      display: none !important;
    }
  }
</style>
