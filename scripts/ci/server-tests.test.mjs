import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover, partition, verifyReports } from './server-tests.mjs';
import { ROOT } from './affected.mjs';

test('all source test classes run exactly once; sampled timings do not exclude new classes', () => {
  const classes = discover();
  const sample = JSON.parse(readFileSync(join(ROOT, 'scripts/ci/server-test-times.json'), 'utf8')).seconds;
  const shards = partition([...classes, 'new.UnsampledTest'], sample);
  const selected = shards.flatMap(s => s.classes);
  assert.ok(classes.length > 400);
  assert.deepEqual(selected.sort(), [...classes, 'new.UnsampledTest'].sort());
  assert.equal(new Set(selected).size, selected.length);
  assert.ok(Math.max(...shards.map(s => s.seconds)) - Math.min(...shards.map(s => s.seconds)) < 2);
  assert.deepEqual(partition([...classes].reverse(), sample), partition(classes, sample));
});

test('discovery follows Surefire default names and includes disabled test classes', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-java-'));
  try {
    mkdirSync(join(root, 'nested'));
    for (const name of ['TestEarly', 'OneTest', 'ManyTests', 'LegacyTestCase', 'DisabledTest', 'Fixture']) {
      writeFileSync(join(root, 'nested', `${name}.java`), `package sample;\n${name === 'DisabledTest' ? '@Disabled' : ''}\nclass ${name} {}`);
    }
    assert.deepEqual(discover(root), ['sample.DisabledTest', 'sample.LegacyTestCase', 'sample.ManyTests', 'sample.OneTest', 'sample.TestEarly']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('report validation accepts nested/disabled tests and rejects missing or extra classes', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-reports-'));
  const report = (file, name, tests = 1) => writeFileSync(join(root, `TEST-${file}.xml`), `<testsuite name="${name}" tests="${tests}"/>`);
  try {
    report('A', 'sample.ATest', 2); report('nested', 'sample.ATest$Nested'); report('disabled', 'sample.DisabledTest');
    const manifest = { classes: ['sample.ATest', 'sample.DisabledTest'] };
    assert.deepEqual(verifyReports(manifest, root), { classes: 2, tests: 4 });
    assert.throws(() => verifyReports({ classes: [...manifest.classes, 'sample.MissingTest'] }, root), /MissingTest/);
    report('extra', 'sample.ExtraTest');
    assert.throws(() => verifyReports(manifest, root), /ExtraTest/);
    assert.throws(() => partition(['a', 'a', 'b'], {}), /Duplicate/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
