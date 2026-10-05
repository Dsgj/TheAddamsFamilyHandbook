/**
 * An inline script's text from a file in src/inline (audit AR3-01, PF3-06, TT3-08). A page's
 * before-paint code lives there as plain JS under `// @ts-check`, imported `?raw` and written into
 * a `<script is:inline set:html>`, so one source is what tsc checks, what the unit tests import
 * and run, and what ships. On the way the comments, blank lines and indentation go (0.8 MB of a
 * build), several files become one script (classify.js ahead of reveal.js) so the `import` lines
 * between them, the `export` keywords and the `export {};` that makes a file a module go too, and
 * the whole runs as one function so no name lands on window. A script's parameters travel as data attributes on its tag, read from
 * document.currentScript.dataset: define:vars left astro check hints it could not resolve.
 *
 * The strip is a small scanner, not a parser: a string or template literal is copied whole (its
 * `//` kept), a backslash protects the next character (so a regex's `\/` is not a comment), and a
 * `//` or `/*` anywhere else is a comment. So a regex literal in src/inline carries no quote and
 * no unescaped `//` or `/*`, and a template literal spans no lines; tests/unit/inline.test.ts
 * parses every file's result.
 */
export function inlineScript(...sources: string[]): string {
  const body = sources
    .map(stripComments)
    .join('\n')
    .replace(/^import\b[^;]*;[ \t]*$/gm, '')
    .replace(/^export \{\};[ \t]*$/gm, '')
    .replace(/^export\s+/gm, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  return `(function () {\n${body}\n})();`;
}

/** The source without its comments; every newline kept, so the lines stay apart. */
function stripComments(src: string): string {
  let out = '';
  for (let i = 0; i < src.length;) {
    const c = src[i]!;
    const d = src[i + 1];
    if (c === '\\') {
      out += c + (d ?? '');
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
