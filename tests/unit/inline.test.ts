import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import classifySrc from '~/inline/classify.js?raw';
import revealSrc from '~/inline/reveal.js?raw';
import { inlineScript } from '~/lib/inline-script';
import { classify, type Visit } from '~/lib/nav-state';
import { CLASSIFY_CASES, NOW } from './classify-cases';

/*
 * The before-paint scripts (audit AR3-01, TT3-04, PF3-06): src/inline holds them as plain JS,
 * inlineScript strips and wraps them, and the shell's pagereveal script, run here in a page-shaped
 * sandbox, types every case of the classifier's table the way `classify` does, since it is the
 * same code.
 */
const DIR = join(process.cwd(), 'src/inline');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.js'));

describe('inlineScript', () => {
  it('strips comments, blank lines, indentation, imports and exports, and wraps the rest', () => {
    const src = `// @ts-check
import { x } from './x.js';
/* a block
   comment */
export const url = 'https://a/b'; // trailing
export function f(p) {
  return p.replace(/\\/index$/, '') + \`//\`;
}

  const q = 1; /* inner */ const r = 2;
`;
    expect(inlineScript(src)).toBe(`(function () {
const url = 'https://a/b';
function f(p) {
return p.replace(/\\/index$/, '') + \`//\`;
}
const q = 1;  const r = 2;
})();`);
  });

  it('reads each file in src/inline to code that parses, with no comment, blank line or module syntax left', () => {
    expect(FILES).toEqual(['classify.js', 'fit.js', 'map.js', 'reveal.js', 'text.js', 'theme.js']);
    for (const f of FILES) {
      const out = inlineScript(readFileSync(join(DIR, f), 'utf8'));
      expect(out, f).not.toMatch(/^\s*(\/\/|\/\*)|^\s*$/m);
      expect(out, f).not.toMatch(/^(import|export)\b/m);
      expect(() => new Function(out), f).not.toThrow();
    }
  });

  it('keeps every file under tsc (// @ts-check) and importing only a neighbour it is inlined with', () => {
    for (const f of FILES) {
      const text = readFileSync(join(DIR, f), 'utf8');
      expect(text.startsWith('// @ts-check\n'), f).toBe(true);
      for (const m of text.matchAll(/^import\b.*?from '\.\/([^']+)';$/gm))
        expect(FILES, `${f} imports ${m[1]}`).toContain(m[1]);
    }
  });
});

type Probe = { type: string; animations: unknown[]; pending?: true; skipped?: true };
type Vt = { types: Set<string>; ready: Promise<void> };

/** Runs the shell's head script (classify.js + reveal.js) in a page-shaped sandbox and fires pagereveal. */
function reveal(
  prev: Visit | null,
  here: { tab: string; depth: number },
  traverse?: 'back' | 'forward',
  vt: Vt | null = { types: new Set(), ready: Promise.resolve() },
) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const sandbox: Record<string, unknown> = {
    document: {
      currentScript: { dataset: { prev: 'tafh:prev' } },
      documentElement: { dataset: { tab: here.tab, depth: String(here.depth) } },
      timeline: {},
      getAnimations: () => [],
    },
    sessionStorage: {
      getItem: (k: string) => (k === 'tafh:prev' && prev ? JSON.stringify(prev) : null),
    },
    navigator: { webdriver: true },
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
    Date: { now: () => NOW },
  };
  if (traverse)
    sandbox.navigation = {
      currentEntry: { index: 5 },
      activation: { navigationType: 'traverse', from: { index: traverse === 'back' ? 6 : 4 } },
    };
  sandbox.window = sandbox;
  runInNewContext(inlineScript(classifySrc, revealSrc), sandbox);
  expect(Object.keys(listeners)).toEqual(['pagereveal']);
  listeners.pagereveal!({ viewTransition: vt });
  return { types: [...(vt?.types ?? [])], motion: () => sandbox.tafhMotion as Probe | undefined };
}

describe('the inlined pagereveal script', () => {
  it.each(CLASSIFY_CASES)('types the transition like classify: $name', (c) => {
    const { types, motion } = reveal(c.prev, c.here, c.traverse);
    expect(types).toEqual([c.expect]);
    expect(classify(c.prev, c.here, c.traverse, NOW)).toBe(c.expect);
    expect(motion()).toEqual({ type: c.expect, animations: [], pending: true });
  });

  it('reports what ran once the transition is ready, a skip when it is not, none without one', async () => {
    const ready = reveal(null, { tab: 'tables', depth: 0 });
    await Promise.resolve();
    expect(ready.motion()).toEqual({ type: 'fade', animations: [] });
    const aborted = reveal(null, { tab: 'tables', depth: 0 }, undefined, {
      types: new Set(),
      ready: Promise.reject(new Error('aborted')),
    });
    await Promise.resolve();
    expect(aborted.motion()).toEqual({ type: 'fade', animations: [], skipped: true });
    const none = reveal(null, { tab: 'tables', depth: 0 }, undefined, null);
    expect(none.types).toEqual([]);
    expect(none.motion()).toEqual({ type: 'none', animations: [] });
  });
});
