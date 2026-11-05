#!/usr/bin/env node
// 手上没有超管令牌、但浏览器已经用超管登录时的发布方式：本机只提供素材，发布由那个页面自己做，
// 令牌不离开浏览器。
//
//   node scripts/inspiration/serve.mjs --skills <resources/skills> --origin https://aistar.aibuzz.cn [--port 18765]
//
// 然后在该站点已登录的页面里执行（先 dry，再去掉）：
//   const m = await import('http://127.0.0.1:18765/browser.mjs');
//   window.__insp = await m.start({ dry: true });   // 可传 only: ['id'] / force: true
// window.__insp.lines 是进度，running 变 false 后 failed 是失败条数。
//
// 只监听本机，只接受 --origin 这一个来源，只提供 catalog.mjs 里点名的素材。

import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSPIRATIONS } from './catalog.mjs';
import { mimeOf, posterOf, probe } from './media.mjs';

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const fail = (message) => { console.error(message); process.exit(1); };
const SKILLS = arg('skills') || fail('缺少 --skills，指向本机的 resources/skills 目录');
const ORIGIN = arg('origin') || fail('缺少 --origin，例如 https://aistar.aibuzz.cn');
const PORT = Number(arg('port', '18765'));

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'inspiration-serve-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));

const pathOf = (skill, file) => join(SKILLS, 'covers', 'by_skill_id', skill, file);
const probes = {}, posters = {};
for (const item of INSPIRATIONS) {
  const refs = [...item.samples.map((file) => [item.skill, file]), ...(item.input?.sample ? [[item.input.sample.skill, item.input.sample.file]] : [])];
  for (const [skill, file] of refs) {
    const path = pathOf(skill, file);
    if (!existsSync(path)) fail(`素材不存在：${path}`);
    probes[`${skill}/${file}`] = probe(path);
  }
  if (item.kind === 'video') {
    const key = `${item.skill}/${item.samples[0]}`;
    posters[key] = posterOf(pathOf(item.skill, item.samples[0]), probes[key].seconds, dir);
  }
}

const SCRIPTS = new Set(['/browser.mjs', '/publish-core.mjs', '/catalog.mjs']);
const server = createServer((req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
  const send = (path, type) => {
    res.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': statSync(path).size });
    createReadStream(path).pipe(res);
  };
  const missing = () => { res.writeHead(404, headers); res.end(); };
  if (req.method !== 'GET') return missing();
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  if (SCRIPTS.has(pathname)) return send(join(here, pathname), 'text/javascript; charset=utf-8');
  if (pathname === '/probe.json') { res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(probes)); return; }
  const [, kind, skill, file] = pathname.split('/').map(decodeURIComponent);
  const key = `${skill}/${file}`;
  if (kind === 'sample' && probes[key]) return send(pathOf(skill, file), mimeOf(file));
  if (kind === 'poster' && posters[key]) return send(posters[key], 'image/jpeg');
  return missing();
});
server.listen(PORT, '127.0.0.1', () => console.log(`素材已就绪：${Object.keys(probes).length} 个，http://127.0.0.1:${PORT}/browser.mjs`));
