<script lang="ts">
  import { list } from './HandbookToc.svelte';

  import type { TocItem } from '~/lib/handbook/types';
  /**
   * A section page's sidebar rows, server-rendered into the HandbookToc island's slot (the island
   * hydrates from 960 and keeps these rows until a query filters them): HandbookToc's own `list`
   * snippet, so its styles apply and the rows never ride as island props (audit P4 item 5, PF-05).
   */
  let { items, current }: { items: TocItem[]; current: string } = $props();
</script>

{@render list(items, current, false, '', '')}
