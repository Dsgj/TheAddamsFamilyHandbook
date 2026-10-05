import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/* The type-aware ESLint block covers the islands (audit TT3-07): no-floating-promises fires in a
   `.svelte` script and a `.svelte.ts` module as it does in `.ts`, where Diagnose.svelte once called
   an async function and dropped the promise. The fixtures are the repo's own files with a promise
   dropped, linted as text under their own paths (the project service takes the text for the path,
   as an editor's unsaved buffer), so what is checked is eslint.config.js itself, not a copy. */

const RULE = '@typescript-eslint/no-floating-promises';
const SVELTE = 'src/components/Diagnose.svelte';
const VOIDED = 'void showRecent();';
const MODULE = 'src/lib/model/recent.svelte.ts';

const eslint = new ESLint({ cwd: process.cwd() });

/** The lines the rule fires on when `text` stands for `filePath`. */
async function floating(text: string, filePath: string): Promise<number[]> {
  const [result] = await eslint.lintText(text, { filePath });
  const fatal = result!.messages.filter((m) => m.fatal);
  expect(fatal, 'the file parsed').toEqual([]);
  return result!.messages.filter((m) => m.ruleId === RULE).map((m) => m.line);
}

describe('the typed lint covers the islands (TT3-07)', () => {
  const svelte = readFileSync(SVELTE, 'utf8');
  const line = svelte.slice(0, svelte.indexOf(VOIDED)).split('\n').length;

  it('flags a promise dropped in a .svelte script', async () => {
    expect(svelte.split(VOIDED)).toHaveLength(2);
    const dropped = svelte.replace(VOIDED, VOIDED.slice('void '.length));
    expect(await floating(dropped, SVELTE)).toEqual([line]);
  }, 180_000);

  it('passes the same script with the promise marked `void`', async () => {
    expect(await floating(svelte, SVELTE)).toEqual([]);
  }, 180_000);

  it('flags a promise dropped in a .svelte.ts module', async () => {
    const module = readFileSync(MODULE, 'utf8').trimEnd();
    const lines = module.split('\n').length;
    expect(await floating(`${module}\nPromise.resolve();\n`, MODULE)).toEqual([lines + 1]);
  }, 180_000);
});
