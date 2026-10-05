/**
 * Spec §5: the breakpoints as media queries, for matchMedia and `client:media`. The CSS writes the
 * same numbers in its @media rules, and the inline head scripts (which cannot import) write these
 * strings by hand; design-system test (y) holds every width and height query in src to this
 * scale.
 */
/** The tab bar and the bottom sheet: under 600. */
export const PHONE = '(max-width: 599px)';
/** The side panel, the page-fit scan and the handbook sidebar: from 1000. */
export const WIDE = '(min-width: 1000px)';
/** The sidebar navigation and its sub-nav pill: from 1280. */
export const DESKTOP = '(min-width: 1280px)';
/** Every width the app's media queries may name, both sides of each step. */
export const BREAKPOINTS = [599, 600, 999, 1000, 1279, 1280] as const;
/** A short view (a phone on its side, a 200 % zoom), under 560: the Diagnose dock heads the
 *  results in flow, and the map's controls sit side by side (audit DS3-10). */
export const SHORT = '(max-height: 559px)';
/** Every height a media query may name: both sides of the one step. */
export const HEIGHTS = [559, 560] as const;
