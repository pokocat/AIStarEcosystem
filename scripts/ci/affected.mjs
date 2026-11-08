// PR checks follow workspace dependencies. Unknown executable/config paths fall
// back to the full suite; documentation never suppresses a runtime resource.
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BROWSER_PRODUCTS = new Set(['admin-new', 'web-music', 'web-drama', 'web-celebrity', 'web-aiavatar', 'web-star']);

export function workspaces(root = ROOT) {
  // Only the packages list, not patchedDependencies further down the YAML.
  const list = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8').split(/\n(?=\S)/)[0];
  const dirs = [...list.matchAll(/^\s+-\s+["']([^"']+)["']/gm)].flatMap(([, pattern]) =>
    pattern.endsWith('/*')
      ? readdirSync(resolve(root, pattern.slice(0, -2)), { withFileTypes: true })
        .filter(e => e.isDirectory()).map(e => `${pattern.slice(0, -1)}${e.name}`)
      : [pattern]);
  return dirs.map(dir => {
    const pkg = JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8'));
    return { dir, name: pkg.name, product: pkg.name.split('/').at(-1), scripts: pkg.scripts ?? {},
      deps: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies }) };
  }).sort((a, b) => b.dir.length - a.dir.length);
}

function documentation(path) {
  return /^(docs|figma)\//.test(path)
    || (/\.(md|txt)$/i.test(path) && !/\/(src|resources|public)\//.test(path))
    || /(^|\/)(LICENSE|NOTICE)(\.[^/]*)?$/.test(path);
}

export function affected(paths, { full = false, packages = workspaces() } = {}) {
  const selected = new Set();
  let backend = full, contract = full, browser = full;
  const selectAll = () => packages.forEach(p => selected.add(p.name));
  const select = product => packages.filter(p => p.product === product).forEach(p => selected.add(p.name));
  const selectFull = () => { backend = contract = browser = true; selectAll(); };
  if (full) selectAll();
  for (const path of paths) {
    if (documentation(path)) continue;
    if (path === '.github/workflows/impersonation-ci.yml' || path.startsWith('scripts/ci/')) {
      selectFull();
    } else if (path.startsWith('apps/server/')) {
      backend = contract = true;
      if (/impersonation|\/(auth|identity|security)\/|SecurityConfig|JwtAuthenticationFilter/i.test(path)) {
        selectAll(); browser = true;
      }
      // These tests consume server resources directly, outside the package graph.
      if (path.startsWith('apps/server/src/main/resources/ipstudio/')) select('web-aiavatar');
      if (path.startsWith('apps/server/src/main/resources/prompts/material/')) select('web-drama');
    } else if (path.startsWith('infra/vendor/platform-sdk/') || path === 'infra/scripts/prepare-platform-sdk.sh') {
      backend = true;
    } else if (path === 'specs/openapi.yaml' || path === 'scripts/check-api-contract.mjs') {
      contract = true;
    } else if (/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|patches\/)/.test(path)) {
      selectAll(); contract = browser = true;
    } else if (path.startsWith('scripts/vitest/')) {
      selectAll();
    } else if (path.startsWith('scripts/inspiration/')) {
      select('web-aiavatar');
    } else if (path.startsWith('scripts/impersonation/')) {
      selectAll(); browser = true;
    } else {
      const owner = packages.find(p => path.startsWith(`${p.dir}/`));
      if (!owner) { selectFull(); continue; }
      selected.add(owner.name);
      contract = true;
      // Shared auth/UI/types can affect every consumer. App layouts/providers,
      // callback routes and auth helpers need the production-browser smoke too.
      if (owner.dir.startsWith('packages/') || /(?:^|\/)(?:auth|shell|providers?)(?:[./-]|$)|(?:^|\/)(?:layout|proxy|next\.config)\.[^/]+$|impersonation|oidc/.test(path)) browser = true;
    }
  }
  // Transitive reverse dependencies, including development-only workspace imports.
  let expanded;
  do {
    expanded = false;
    for (const p of packages) if (!selected.has(p.name) && p.deps.some(d => selected.has(d))) {
      selected.add(p.name); expanded = true;
    }
  } while (expanded);
  const targets = packages.filter(p => selected.has(p.name)).sort((a, b) => a.name.localeCompare(b.name));
  return {
    backend, contract,
    frontend: targets.filter(p => p.scripts.typecheck || p.scripts.test).flatMap(p =>
      p.product === 'web-aiavatar' ? [1, 2].map(shard => ({ package: p.name, shard })) : [{ package: p.name, shard: 0 }]),
    builds: targets.filter(p => p.scripts.build && p.dir.startsWith('apps/'))
      .map(p => ({ package: p.name, product: p.product, browser: browser && BROWSER_PRODUCTS.has(p.product) })),
  };
}

export function changedPaths(base, head, root = ROOT) {
  // No rename detection: both old and new paths must trigger their owners.
  // Compare the PR base directly with GitHub's tested merge commit. A merge-base
  // diff against the head alone can miss the effect of the current base branch.
  return execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, head, '--'], { cwd: root })
    .toString().split('\0').filter(Boolean);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const full = process.env.GITHUB_EVENT_NAME !== 'pull_request';
  if (!full && (!process.env.CI_BASE_SHA || !process.env.CI_HEAD_SHA)) throw new Error('PR base/head SHA required');
  const plan = affected(full ? [] : changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA), { full });
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) for (const [key, value] of Object.entries(plan)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${JSON.stringify(value)}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### CI scope\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`);
}
