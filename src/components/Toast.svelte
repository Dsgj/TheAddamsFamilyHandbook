<script lang="ts">
  import { onMount } from 'svelte';
  import { emit, listen, type ToastDetail } from '~/lib/events';

  /**
   * The toast host (spec §8.8), mounted once in Base.astro. pwa.ts, the app's actions (`toast`
   * in events.ts) and the tests raise the `toast` event with `{ kind, text }`. One toast at a
   * time: Update ready outlasts everything and stays until Reload; the others leave after 4 s.
   * A shorter toast raised while Update shows is not dropped: it takes the 4 s and Update comes
   * back after it, so "not saving changes" is never lost to an update (CO3-04).
   * The host is a plain aria-live region (never `role=status`: /care, /setup and /shopping run a
   * strict `getByRole('status')`) and passes pointer events through; only Reload takes them.
   * It sits 10 above the tab bar, lifted by --toast-lift over a reader toolbar (ReaderBar), the
   * map's sheet (BottomSheet) or the Diagnose dock, and under a modal sheet, which makes it inert
   * (spec §4, §8.8).
   */
  const DWELL = 4000;
  let toast = $state<ToastDetail | null>(null);
  /** The Update toast, waiting behind a shorter one. */
  let held: ToastDetail | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function show(t: ToastDetail) {
    clearTimeout(timer);
    if (t.kind === 'update') {
      held = null;
      toast = t;
      return;
    }
    if (toast?.kind === 'update') held = toast;
    toast = t;
    timer = setTimeout(() => {
      toast = held;
      held = null;
    }, DWELL);
  }
  function reload() {
    emit('reload');
  }
  onMount(() => {
    // A spec or a stale page may raise it by hand, so the detail is checked.
    const off = listen('toast', (d?: Partial<ToastDetail>) => {
      if (d && typeof d.text === 'string')
        show({ kind: d.kind === 'update' || d.kind === 'offline' ? d.kind : 'info', text: d.text });
    });
    // An Update ready dispatched before this host hydrated (PF2-03).
    if (window.tafhToast) show(window.tafhToast);
    return () => {
      off();
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
