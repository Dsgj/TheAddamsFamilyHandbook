// The flaky tests of a Playwright run, as Markdown for the CI job summary (audit TT2-04). A test
// that failed and then passed on its retry is green, so the run alone never shows it; this lists
// each one with its file, line and project, and the annotations it left (a dropped view
// transition, say), so a flake that grows is seen before it turns red.
//
//   node scripts/flaky.mjs test-results/report.json >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'test-results/report.json';
if (!existsSync(file)) {
  console.log(`No Playwright report at \`${file}\`.`);
  process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));

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
    if (test.status !== 'flaky') continue;
    // the same note repeated (a transition dropped on every attempt) is counted, not listed
    const notes = new Map();
    for (const a of test.annotations ?? []) {
      const note = a.description ?? a.type;
      notes.set(note, (notes.get(note) ?? 0) + 1);
    }
    const said = [...notes].map(([note, n]) => (n > 1 ? `${note} (x${n})` : note));
    rows.push(
      `| ${[...path, spec.title].join(' › ')} | ${spec.file}:${spec.line} | ${test.projectName} | ` +
        `${test.results?.length ?? 0} | ${said.join('; ').replaceAll('|', '/')} |`,
    );
  }
}

console.log(`### Flaky tests (${[...projects].join(', ') || 'Playwright'})\n`);
if (!rows.length) console.log('None: every test passed on its first attempt.');
else {
  console.log('| Test | Where | Project | Attempts | Notes |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const r of rows) console.log(r);
}
