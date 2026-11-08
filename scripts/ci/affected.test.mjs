import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { affected, changedPaths, workspaces, ROOT } from './affected.mjs';

const names = plan => plan.frontend.map(p => p.package);
const products = plan => plan.builds.map(p => p.product);

test('documentation-only changes start no heavy job, including application READMEs', () => {
  const plan = affected(['AGENTS.md', 'docs/runbooks/model-task-alerts.md', 'apps/server/README.md', 'apps/web-aiavatar/PRODUCT.md']);
  assert.deepEqual(plan, { backend: false, contract: false, frontend: [], builds: [] });
});

test('Studio source checks only Studio; ordinary business changes do not run the auth browser', () => {
  const plan = affected(['apps/web-aiavatar/src/ip/assets-hub.tsx']);
  assert.deepEqual(products(plan), ['web-aiavatar']);
  assert.deepEqual(names(plan), ['@ai-star-eco/web-aiavatar']);
  assert.equal(plan.backend, false);
  assert.equal(plan.contract, true);
  assert.equal(plan.builds[0].browser, false);
});

test('nested Studio admin is independent of its parent application', () => {
  assert.deepEqual(products(affected(['apps/web-aiavatar/studio-admin/src/components/models.tsx'])), ['studio-admin']);
});

test('shared package changes expand through transitive and development dependencies', () => {
  const packages = [
    { dir: 'packages/base', name: 'base', product: 'base', deps: [], scripts: { typecheck: 'tsc' } },
    { dir: 'packages/bridge', name: 'bridge', product: 'bridge', deps: ['base'], scripts: { typecheck: 'tsc' } },
    { dir: 'apps/app', name: 'app', product: 'app', deps: ['bridge'], scripts: { build: 'next build', test: 'vitest' } },
    { dir: 'apps/other', name: 'other', product: 'other', deps: [], scripts: { test: 'vitest' } },
  ];
  assert.deepEqual(names(affected(['packages/base/src/index.ts'], { packages })), ['app', 'base', 'bridge']);
  assert.deepEqual(products(affected(['packages/base/src/index.ts'], { packages })), ['app']);
});

test('the real UI package fans out only to its workspace consumers', () => {
  const plan = affected(['packages/ui/src/button.tsx']);
  assert.equal(plan.backend, false);
  assert.ok(names(plan).includes('@ai-star-eco/ui'));
  assert.ok(products(plan).includes('web-aiavatar'));
  assert.ok(products(plan).includes('studio-admin'));
});

test('backend changes retain the entire backend suite but avoid unrelated frontends', () => {
  const plan = affected(['apps/server/src/main/java/com/aistareco/aep/service/CreditService.java']);
  assert.equal(plan.backend, true);
  assert.equal(plan.contract, true);
  assert.deepEqual(plan.frontend, []);
});

test('server-owned markdown prompts are executable resources, not documentation', () => {
  const plan = affected(['apps/server/src/main/resources/prompts/material/drama.frame_image.md']);
  assert.equal(plan.backend, true);
  assert.deepEqual(products(plan), ['web-drama']);
});

test('server scene data also checks its direct frontend consumers', () => {
  const plan = affected(['apps/server/src/main/resources/ipstudio/scenes.json']);
  assert.equal(plan.backend, true);
  assert.deepEqual(products(plan), ['web-aiavatar']);
});

test('authentication, shared layouts and middleware enable the browser smoke', () => {
  for (const file of ['src/app/auth/callback/page.tsx', 'src/app/(workspace)/layout.tsx', 'src/shell/top-bar.tsx', 'src/proxy.ts', 'next.config.ts']) {
    const plan = affected([`apps/web-drama/${file}`]);
    assert.equal(plan.builds[0].browser, true, file);
    assert.deepEqual(products(plan), ['web-drama']);
  }
  assert.ok(affected(['packages/api-client/src/oidc.ts']).builds.filter(p => p.product.startsWith('web-') && p.product !== 'web-incubator').every(p => p.browser));
  const serverAuth = affected(['apps/server/src/main/java/com/aistareco/aep/identity/ImpersonationService.java']);
  assert.equal(serverAuth.backend, true);
  assert.equal(serverAuth.builds.filter(p => p.browser).length, 6);
});

test('script consumers and contract-only changes have explicit scopes', () => {
  assert.deepEqual(products(affected(['scripts/inspiration/catalog.mjs'])), ['web-aiavatar']);
  for (const path of ['specs/openapi.yaml', 'scripts/check-api-contract.mjs']) {
    assert.deepEqual(affected([path]), { backend: false, contract: true, frontend: [], builds: [] });
  }
});

test('lockfile changes check all frontends but do not start Maven', () => {
  const plan = affected(['pnpm-lock.yaml']);
  assert.equal(plan.backend, false);
  assert.equal(plan.frontend.length, workspaces().length);
});

test('unknown files, deleted workspaces and CI changes fall back to full checks', () => {
  for (const path of ['new-root-config.json', 'apps/removed-app/package.json', '.github/workflows/impersonation-ci.yml', 'scripts/ci/affected.mjs']) {
    const plan = affected([path]);
    assert.equal(plan.backend, true, path);
    assert.equal(plan.frontend.length, workspaces().length, path);
  }
});

test('manual and scheduled full checks include every app, with browsers only for supported products', () => {
  const plan = affected([], { full: true });
  assert.equal(plan.backend, true);
  assert.equal(plan.contract, true);
  assert.equal(plan.frontend.length, workspaces().length);
  assert.equal(plan.builds.filter(p => p.browser).length, 6);
  assert.ok(products(plan).includes('studio-admin'));
  assert.ok(products(plan).includes('web-incubator'));
});

test('CLI writes typed GitHub outputs and refuses a PR without diff SHAs', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-outputs-'));
  const output = join(root, 'output'), summary = join(root, 'summary');
  const run = env => spawnSync(process.execPath, [join(ROOT, 'scripts/ci/affected.mjs')], {
    env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...env }, encoding: 'utf8',
  });
  try {
    const result = run({ GITHUB_EVENT_NAME: 'workflow_dispatch' });
    assert.equal(result.status, 0, result.stderr);
    const outputs = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => {
      const split = line.indexOf('='); return [line.slice(0, split), JSON.parse(line.slice(split + 1))];
    }));
    assert.equal(outputs.backend, true);
    assert.equal(outputs.contract, true);
    assert.equal(outputs.frontend.length, workspaces().length);
    assert.equal(outputs.builds.filter(p => p.browser).length, 6);
    assert.match(readFileSync(summary, 'utf8'), /CI scope/);
    assert.notEqual(run({ GITHUB_EVENT_NAME: 'pull_request', CI_BASE_SHA: '', CI_HEAD_SHA: '' }).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('git diff includes both sides of a rename, deletions and filenames containing spaces', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-scope-'));
  const git = (...args) => execFileSync('git', args, { cwd: root }).toString().trim();
  try {
    git('init', '-q'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
    writeFileSync(join(root, 'old name.ts'), 'export const a = 1;\n');
    writeFileSync(join(root, 'deleted.ts'), 'export const b = 2;\n');
    git('add', '.'); git('commit', '-qm', 'base'); const base = git('rev-parse', 'HEAD');
    git('mv', 'old name.ts', 'new name.ts'); git('rm', '-q', 'deleted.ts'); git('commit', '-qm', 'head');
    assert.deepEqual(changedPaths(base, 'HEAD', root).sort(), ['deleted.ts', 'new name.ts', 'old name.ts']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('depth-two checkout of a PR merge compares against the current base, not its old ancestor', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-merge-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  try {
    git('init', '-qb', 'main'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
    writeFileSync(join(root, 'common.ts'), 'initial\n'); git('add', '.'); git('commit', '-qm', 'initial');
    git('checkout', '-qb', 'feature');
    writeFileSync(join(root, 'feature.ts'), 'feature\n'); git('add', '.'); git('commit', '-qm', 'feature');
    git('checkout', 'main');
    writeFileSync(join(root, 'base.ts'), 'base advanced\n'); git('add', '.'); git('commit', '-qm', 'base advanced');
    const base = git('rev-parse', 'HEAD');
    git('merge', '--no-ff', 'feature', '-m', 'PR merge');
    const checkout = join(root, 'checkout');
    git('clone', '-q', '--depth=2', `file://${root}`, checkout);
    assert.deepEqual(changedPaths(base, 'HEAD', checkout), ['feature.ts']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
