import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

/* The deploy workflow keeps its gated shape (audit TT-01): every push to main and every pull
   request runs the checks; a deployment needs all of them and never runs for a pull request; one
   build feeds the unit tests and every e2e project (TT2-14); the e2e matrix names every Playwright
   project but the sub-path one, which runs on the Pages build (TT2-03); the Docker image is
   smoke-tested (TT2-10). YAML is read, not run, so this guards the file's structure, not GitHub's
   behaviour. */

type Step = { run?: string; uses?: string; with?: Record<string, unknown> };
type Job = {
  needs?: string[];
  if?: string;
  env?: Record<string, string>;
  steps: Step[];
  strategy?: { matrix: { include: { project: string }[] } };
  'timeout-minutes'?: number;
};
type Workflow = { on: Record<string, unknown>; jobs: Record<string, Job> };

const wf = load(readFileSync('.github/workflows/deploy.yml', 'utf8')) as Workflow;
const runs = (job: Job) => job.steps.map((s) => s.run ?? '').filter(Boolean);
const projects = [...readFileSync('playwright.config.ts', 'utf8').matchAll(/name: '([a-z-]+)'/g)]
  .map((m) => m[1]!)
  .filter((p) => p !== 'subpath')
  .sort();
/** The step that fetches the shared build, and its place among the job's steps. */
const download = (job: Job) =>
  job.steps.findIndex(
    (s) => s.uses?.startsWith('actions/download-artifact@') && s.with?.name === 'dist',
  );
const at = (job: Job, run: string) => job.steps.findIndex((s) => s.run === run);

describe('deploy workflow', () => {
  it('runs on every pull request and on pushes to main', () => {
    expect(wf.on).toHaveProperty('pull_request');
    expect(wf.on.push).toEqual({ branches: ['main'] });
  });

  it('deploys only after every gate, never for a pull request', () => {
    const deploy = wf.jobs.deploy!;
    expect(deploy.needs).toEqual(['static', 'e2e', 'pages', 'docker']);
    // Exact: `always() && …` would deploy past a red gate, and continue-on-error hides one.
    expect(deploy.if).toBe(
      "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'",
    );
    expect(JSON.stringify(wf.jobs)).not.toContain('continue-on-error');
  });

  it('builds once and hands the build on', () => {
    const build = wf.jobs.build!;
    expect(runs(build)).toContain('pnpm build');
    expect(
      build.steps.some(
        (s) => s.uses?.startsWith('actions/upload-artifact@') && s.with?.name === 'dist',
      ),
    ).toBe(true);
    // no other gate builds the default-base site again
    expect(runs(wf.jobs.static!)).not.toContain('pnpm build');
    expect(runs(wf.jobs.e2e!)).not.toContain('pnpm build');
  });

  it('fails fast before building, installing browsers or building the Docker image', () => {
    const build = wf.jobs.build!;
    for (const run of ['pnpm check', 'pnpm svelte-check', 'pnpm lint', 'pnpm format:check']) {
      expect(at(build, run), run).toBeGreaterThan(at(build, 'pnpm install --frozen-lockfile'));
      expect(at(build, run), run).toBeLessThan(at(build, 'pnpm build'));
    }
    for (const id of ['static', 'e2e', 'pages', 'docker'])
      expect(wf.jobs[id]!.needs).toContain('build');
  });

  it('runs unit and artifact checks on the same shared build, without repeating the fast checks', () => {
    const job = wf.jobs.static!;
    expect(runs(job)).toContain('pnpm test');
    expect(runs(job)).not.toContain('pnpm check');
    expect(job.needs).toEqual(['build']);
    expect(download(job)).toBeGreaterThan(-1);
    expect(download(job)).toBeLessThan(at(job, 'pnpm test'));
  });

  it('the e2e job installs the browsers with their dependencies and runs every project', () => {
    const e2e = wf.jobs.e2e!;
    expect(e2e.needs).toEqual(['build']);
    expect(runs(e2e).some((s) => /playwright install --with-deps/.test(s))).toBe(true);
    expect(download(e2e)).toBeGreaterThan(-1);
    expect(e2e.strategy!.matrix.include.map((i) => i.project).sort()).toEqual(projects);
    expect(projects).toHaveLength(3);
  });

  it('the Pages job checks the build that ships, under its base', () => {
    const pages = wf.jobs.pages!;
    expect(pages.env?.BASE_PATH).toMatch(/^\/.+\/$/);
    const r = runs(pages);
    expect(r.indexOf('pnpm build')).toBeLessThan(r.indexOf('pnpm test tests/unit/links.test.ts'));
    expect(r.indexOf('pnpm build')).toBeLessThan(
      r.indexOf('pnpm exec playwright test --project subpath'),
    );
    expect(pages.steps.at(-1)!.uses).toMatch(/^actions\/upload-pages-artifact@/);
  });

  it('the docker job smoke-tests the image', () => {
    expect(runs(wf.jobs.docker!)).toContain('sh scripts/docker-smoke.sh docker');
  });

  it('bounds every job and does not persist checkout credentials', () => {
    for (const job of Object.values(wf.jobs)) {
      expect(job['timeout-minutes']).toBeGreaterThan(0);
      expect(job['timeout-minutes']).toBeLessThanOrEqual(30);
      for (const step of job.steps.filter((step) => step.uses?.startsWith('actions/checkout@')))
        expect(step.with?.['persist-credentials']).toBe(false);
    }
  });

  it('stamps the tested Pages artifact before upload and verifies it only after deployment', () => {
    const pages = wf.jobs.pages!;
    const stamp = at(pages, 'node scripts/deploy-check.mjs stamp');
    expect(stamp).toBeGreaterThan(at(pages, 'pnpm exec playwright test --project subpath'));
    expect(stamp).toBeLessThan(pages.steps.length - 1);
    const deploy = wf.jobs.deploy!;
    const publish = deploy.steps.findIndex((step) =>
      step.uses?.startsWith('actions/deploy-pages@'),
    );
    expect(at(deploy, 'node scripts/deploy-check.mjs check')).toBeGreaterThan(publish);
    expect(runs(deploy)).not.toContain('pnpm build');
    expect(runs(deploy)).not.toContain('pnpm install --frozen-lockfile');
  });
});
