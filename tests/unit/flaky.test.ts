import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/* scripts/flaky.mjs turns a Playwright JSON report into the CI job summary (audit TT2-04, TT3-05):
   the tests that failed and passed on a retry, and since round 3 the tests that passed first time
   but retried inside themselves, which helpers.ts `transition()` records as a 'dropped view
   transition' annotation. Here on small reports of the shape Playwright writes: a flaky test is
   listed with its attempts and its repeated note counted, a passed test with a note is listed as
   passed, a clean pass and a skip (whose annotation is Playwright's own) are not, and a missing
   report says so. */

const dir = mkdtempSync(join(tmpdir(), 'tafh-flaky-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Test = {
  projectName: string;
  status: 'expected' | 'flaky' | 'unexpected' | 'skipped';
  annotations: { type: string; description?: string }[];
  results: { status: string }[];
};
type Spec = { title: string; file: string; line: number; tests: Test[] };
type Suite = { title: string; file?: string; specs: Spec[]; suites?: Suite[] };

const test = (over: Partial<Test>): Test => ({
  projectName: 'desktop-light',
  status: 'expected',
  annotations: [],
  results: [{ status: 'passed' }],
  ...over,
});

const drop = { type: 'dropped view transition', description: '/switches/: none (skipped)' };

const report: Suite[] = [
  {
    title: 'motion.spec.ts',
    file: 'motion.spec.ts',
    specs: [
      {
        title: 'passes clean',
        file: 'motion.spec.ts',
        line: 10,
        tests: [test({})],
      },
      {
        title: 'retried inside',
        file: 'motion.spec.ts',
        line: 20,
        tests: [test({ annotations: [drop] })],
      },
      {
        title: 'phone only',
        file: 'motion.spec.ts',
        line: 30,
        tests: [test({ status: 'skipped', annotations: [{ type: 'skip', description: 'phone' }] })],
      },
    ],
    suites: [
      {
        title: 'back',
        specs: [
          {
            title: 'returns',
            file: 'motion.spec.ts',
            line: 40,
            tests: [
              test({
                projectName: 'phone-dark',
                status: 'flaky',
                annotations: [drop, drop],
                results: [{ status: 'failed' }, { status: 'passed' }],
              }),
            ],
          },
        ],
      },
    ],
  },
];

function summary(suites: Suite[] | null, name = 'report.json'): string {
  const file = join(dir, name);
  if (suites) writeFileSync(file, JSON.stringify({ suites }));
  return execFileSync(process.execPath, [join(process.cwd(), 'scripts/flaky.mjs'), file], {
    encoding: 'utf8',
  });
}

describe('scripts/flaky.mjs', () => {
  const out = summary(report);
  const rows = out.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---'));

  it('heads the table with the projects and the columns', () => {
    expect(out).toContain('### Flaky tests and in-test retries (desktop-light, phone-dark)');
    expect(rows[0]).toBe('| Test | Where | Project | Status | Attempts | Notes |');
  });

  it('lists a flaky test with its describe path, attempts and the repeated note counted', () => {
    expect(rows).toContain(
      '| back › returns | motion.spec.ts:40 | phone-dark | flaky | 2 | ' +
        'dropped view transition: /switches/: none (skipped) (x2) |',
    );
  });

  it('lists a test that passed first time but retried inside (TT3-05)', () => {
    expect(rows).toContain(
      '| retried inside | motion.spec.ts:20 | desktop-light | passed | 1 | ' +
        'dropped view transition: /switches/: none (skipped) |',
    );
  });

  it("leaves out a clean pass and a skip, whose annotation is Playwright's own", () => {
    expect(out).not.toContain('passes clean');
    expect(out).not.toContain('phone only');
    expect(rows).toHaveLength(3);
  });

  it('says so when nothing is listed, and when there is no report', () => {
    expect(
      summary(
        [
          {
            title: 'a.spec.ts',
            specs: [{ title: 'ok', file: 'a.spec.ts', line: 1, tests: [test({})] }],
          },
        ],
        'clean.json',
      ),
    ).toContain('None: every test passed on its first attempt and left no note.');
    expect(summary(null, 'missing.json')).toMatch(/^No Playwright report at `.*missing\.json`\./);
  });
});
