import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

/* The deploy workflow keeps its gated shape (audit TT-01): every push to main and every pull
   request runs the checks; a deployment needs all of them and never runs for a pull request; the
   e2e matrix names every Playwright project. YAML is read, not run, so this guards the file's
   structure, not GitHub's behaviour. */

type Step = { run?: string; uses?: string };
type Job = {
  needs?: string[];
  if?: string;
  steps: Step[];
  strategy?: { matrix: { include: { project: string }[] } };
};
type Workflow = { on: Record<string, unknown>; jobs: Record<string, Job> };

const wf = load(readFileSync('.github/workflows/deploy.yml', 'utf8')) as Workflow;
const runs = (job: Job) => job.steps.map((s) => s.run ?? '').filter(Boolean);
const projects = [...readFileSync('playwright.config.ts', 'utf8').matchAll(/name: '([a-z-]+)'/g)]
  .map((m) => m[1]!)
  .sort();

describe('deploy workflow', () => {
  it('runs on every pull request and on pushes to main', () => {
    expect(wf.on).toHaveProperty('pull_request');
    expect(wf.on.push).toEqual({ branches: ['main'] });
  });

  it('deploys only after every gate, never for a pull request', () => {
    const deploy = wf.jobs.deploy!;
    expect(deploy.needs).toEqual(['static', 'e2e', 'build']);
    // Exact: `always() && …` would deploy past a red gate, and continue-on-error hides one.
    expect(deploy.if).toBe(
      "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'",
    );
    expect(JSON.stringify(wf.jobs)).not.toContain('continue-on-error');
  });

  it('the static job runs every check, with the build before the unit tests', () => {
    const r = runs(wf.jobs.static!);
    for (const s of [
      'pnpm check',
      'pnpm svelte-check',
      'pnpm lint',
      'pnpm format:check',
      'pnpm build',
      'pnpm test',
    ])
      expect(r, s).toContain(s);
    expect(r.indexOf('pnpm build')).toBeLessThan(r.indexOf('pnpm test'));
  });

  it('the e2e job installs the browsers with their dependencies and runs every project', () => {
    const e2e = wf.jobs.e2e!;
    expect(runs(e2e).some((s) => /playwright install --with-deps/.test(s))).toBe(true);
    expect(runs(e2e)).toContain('pnpm build');
    expect(e2e.strategy!.matrix.include.map((i) => i.project).sort()).toEqual(projects);
  });
});
