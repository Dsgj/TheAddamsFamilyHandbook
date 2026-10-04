// Safari reads autocorrect on a textarea too; svelte/elements types it on input alone (CR3-08).
import 'svelte/elements';

declare module 'svelte/elements' {
  interface HTMLTextareaAttributes {
    autocorrect?: 'on' | 'off' | '' | undefined | null;
  }
}
