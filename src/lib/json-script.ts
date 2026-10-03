/**
 * JSON for an inline `<script type="application/json">` (the shell's #tafh-shop, a section page's
 * #tafh-toc): every `<` is written as the JSON escape `\u003c`, so the text carries neither a `</`
 * (which ends the element) nor a `<!--` (which, before a `<script`, keeps the real end tag from
 * closing it); JSON.parse reads it back unchanged. tests/unit/payload.test.ts checks every page.
 */
export const jsonScript = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');
