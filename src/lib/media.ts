import { MediaQuery } from 'svelte/reactivity';
import { DESKTOP, PHONE, REDUCED, WIDE } from '~/lib/bp';

/**
 * The breakpoints and the motion preference as live queries, one set for every island (audit
 * SV2-15). Read `.current` where the value is needed, in markup, a $derived or a handler, and it
 * follows the window; on the server each is false.
 */
export const media = {
  /** Under 600: the tab bar and the bottom sheet. */
  phone: new MediaQuery(PHONE),
  /** From 1000: the side panel, the page-fit scan and the handbook sidebar. */
  wide: new MediaQuery(WIDE),
  /** From 1280: the sidebar navigation and the map's keyboard legend. */
  desktop: new MediaQuery(DESKTOP),
  /** The system asks for less motion. */
  reduced: new MediaQuery(REDUCED),
};
