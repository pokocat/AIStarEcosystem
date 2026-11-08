// Keep all Surefire-default test classes. Timings only balance the three jobs;
// a class absent from the timing sample still runs. Each job stays serial.
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './affected.mjs';

export function discover(root = resolve(ROOT, 'apps/server/src/test/java')) {
  const files = [];
  const visit = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/^(Test.*|.*Tests?|.*TestCase)\.java$/.test(entry.name)) files.push(path);
    }
  };
  visit(root);
  return files.map(path => {
    const pkg = readFileSync(path, 'utf8').match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
    return [pkg, basename(path, '.java')].filter(Boolean).join('.');
  }).sort();
}

export function partition(classes, seconds, count = 3) {
  if (!Number.isInteger(count) || count < 1 || classes.length < count) throw new Error('Invalid shard count');
  if (new Set(classes).size !== classes.length) throw new Error('Duplicate test class');
  const weight = name => Math.max(0.01, seconds[name] ?? 1);
  const shards = Array.from({ length: count }, (_, index) => ({ index: index + 1, classes: [], seconds: 0 }));
  for (const name of [...classes].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const shard = [...shards].sort((a, b) => a.seconds - b.seconds || a.classes.length - b.classes.length || a.index - b.index)[0];
    shard.classes.push(name); shard.seconds += weight(name);
  }
  return shards.map(s => ({ ...s, classes: s.classes.sort(), seconds: Math.round(s.seconds * 100) / 100 }));
}

export function verifyReports(manifest, directory) {
  const actual = new Set();
  let tests = 0;
  for (const name of readdirSync(directory).filter(n => /^TEST-.*\.xml$/.test(n))) {
    const xml = readFileSync(resolve(directory, name), 'utf8');
    const suite = xml.match(/<testsuite\b[^>]*>/)?.[0];
    const className = suite?.match(/\bname="([^"]+)"/)?.[1]?.split('$')[0];
    if (!className) throw new Error(`Missing suite name in ${name}`);
    actual.add(className);
    tests += Number(suite.match(/\btests="(\d+)"/)?.[1] ?? 0);
  }
  const expected = new Set(manifest.classes);
  const missing = [...expected].filter(name => !actual.has(name));
  const unexpected = [...actual].filter(name => !expected.has(name));
  if (missing.length || unexpected.length || !tests) {
    throw new Error(JSON.stringify({ missing, unexpected, tests }));
  }
  return { classes: actual.size, tests };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, value, path] = process.argv.slice(2);
  if (command === 'plan') {
    const timings = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/server-test-times.json'), 'utf8')).seconds;
    const shard = partition(discover(), timings).find(s => s.index === Number(value));
    if (!shard) throw new Error('Shard must be 1, 2 or 3');
    writeFileSync(path, JSON.stringify(shard, null, 2) + '\n');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tests=${shard.classes.join(',')}\n`);
    console.log(`Shard ${value}: ${shard.classes.length} classes, sampled test time ${shard.seconds}s`);
  } else if (command === 'verify') {
    const manifest = JSON.parse(readFileSync(value, 'utf8'));
    console.log(verifyReports(manifest, path));
    mkdirSync(path, { recursive: true });
    writeFileSync(resolve(path, 'shard-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  } else throw new Error('Expected plan <shard> <manifest> or verify <manifest> <reports>');
}
