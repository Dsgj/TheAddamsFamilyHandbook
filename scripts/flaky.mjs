// The tests of a Playwright run worth a look, as Markdown for the CI job summary (audit TT2-04,
// TT3-05). A test that failed and then passed on its retry is green, so the run alone never shows
// it; and a test that passed first time may have retried inside itself (helpers.ts `transition()`
// makes a dropped view transition again and notes each drop as an annotation), which the run
// shows even less. This lists both with file, line, project and status, and the notes they left,
// so a flake that grows is seen before it turns red.
//
//   node scripts/flaky.mjs test-results/report.json >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'test-results/report.json';
if (!existsSync(file)) {
  console.log(`No Playwright report at \`${file}\`.`);
  process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));

/** The annotations Playwright writes itself (test.skip, .fixme, .slow, .fail): not a note. */
const BUILT_IN = new Set(['skip', 'fixme', 'slow', 'fail']);
const STATUS = { expected: 'passed', flaky: 'flaky', unexpected: 'failed', skipped: 'skipped' };

/** Every spec in the report, with the titles of the describe blocks around it. */
function* specs(suites, path = []) {
  for (const suite of suites ?? []) {
    const here = suite.title && !suite.title.endsWith('.ts') ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) yield { spec, path: here };
    yield* specs(suite.suites, here);
  }
}

const rows = [];
const projects = new Set();
for (const { spec, path } of specs(report.suites)) {
  for (const test of spec.tests ?? []) {
    projects.add(test.projectName);
    // the same note repeated (a transition dropped on every attempt) is counted, not listed
    const notes = new Map();
    for (const a of test.annotations ?? []) {
      if (BUILT_IN.has(a.type)) continue;
      const note = a.description ? `${a.type}: ${a.description}` : a.type;
      notes.set(note, (notes.get(note) ?? 0) + 1);
    }
    if (test.status !== 'flaky' && !notes.size) continue;
    const said = [...notes].map(([note, n]) => (n > 1 ? `${note} (x${n})` : note));
    rows.push(
      `| ${[...path, spec.title].join(' › ')} | ${spec.file}:${spec.line} | ${test.projectName} | ` +
        `${STATUS[test.status] ?? test.status} | ${test.results?.length ?? 0} | ` +
        `${said.join('; ').replaceAll('|', '/')} |`,
    );
  }
}

console.log(`### Flaky tests and in-test retries (${[...projects].join(', ') || 'Playwright'})\n`);
if (!rows.length) console.log('None: every test passed on its first attempt and left no note.');
else {
  console.log('| Test | Where | Project | Status | Attempts | Notes |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) console.log(r);
}
