<script lang="ts">
  /**
   * The one search field (spec §8.7, audit SV-16): the global `.search` pill (36 painted, 44 to
   * tap) inside a `.srch`, and a "Clear search" button while the field holds text. Clearing
   * empties the field (or runs `onclear`, which then owns the reset), and focus goes back to the
   * field. The owner keeps its own filtering; this only renders the field.
   */
  let {
    value = $bindable(''),
    label,
    placeholder = '',
    autofocus = false,
    input = $bindable(),
    onfocus,
    oninput,
    onclear,
  }: {
    value?: string;
    /** The accessible name. */
    label: string;
    placeholder?: string;
    /** Marks the field for BottomSheet's first focus (`data-autofocus`). */
    autofocus?: boolean;
    /** The input element, for owners that focus it themselves. */
    input?: HTMLInputElement | undefined;
    onfocus?: (e: FocusEvent) => void;
    oninput?: (e: Event) => void;
    onclear?: () => void;
  } = $props();

  function clear() {
    if (onclear) onclear();
    else value = '';
    input?.focus();
  }
</script>

<div class="srch">
  <input
    class="search"
    type="search"
    aria-label={label}
    {placeholder}
    autocomplete="off"
    data-autofocus={autofocus ? '' : undefined}
    bind:this={input}
    bind:value
    {onfocus}
    {oninput}
  />
  {#if value}
    <button class="ibtn clear" type="button" aria-label="Clear search" onclick={clear}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  {/if}
</div>
