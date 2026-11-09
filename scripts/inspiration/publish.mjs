#!/usr/bin/env node
// 把 catalog.mjs 里的示例发布成灵感库的官方示例（docs/studio-inspiration-library.md）。
//
//   node scripts/inspiration/publish.mjs --base http://localhost:18181 --skills <resources/skills> [--only id,id] [--dry-run] [--force]
//   node scripts/inspiration/publish.mjs --base http://localhost:18181 --rebuild [--only id,id] [--dry-run]
//
// 令牌从环境变量 STUDIO_TOKEN 读，必须是超级管理员（发布官方内容的既有要求）。不接受明文账号密码。
// 发布逻辑、rebuild 和 force 的区别见 publish-core.mjs。rebuild 只用线上已有的素材，不需要 --skills。

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { publishAll } from './publish-core.mjs';
import { mimeOf, posterOf, probe } from './media.mjs';

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);
const fail = (message) => { console.error(message); process.exit(1); };

const BASE = (arg('base') || fail('缺少 --base，例如 http://localhost:18181')).replace(/\/$/, '');
const REBUILD = has('rebuild');
const SKILLS = arg('skills') || (REBUILD ? '' : fail('缺少 --skills，指向本机的 resources/skills 目录'));
const DRY = has('dry-run');
// rebuild 的 dry-run 也要读线上画布，同样要令牌。
const TOKEN = process.env.STUDIO_TOKEN || (DRY && !REBUILD ? '' : fail('缺少环境变量 STUDIO_TOKEN（超级管理员令牌）'));

const sampleFile = (skill, file) => join(SKILLS, 'covers', 'by_skill_id', skill, file);
const dir = mkdtempSync(join(tmpdir(), 'inspiration-'));
let failed = 1;
try {
  failed = await publishAll({
    base: BASE,
    token: () => TOKEN,
    has: (skill, file) => existsSync(sampleFile(skill, file)),
    sample: (skill, file) => {
      const path = sampleFile(skill, file);
      return { blob: new Blob([readFileSync(path)], { type: mimeOf(path) }), name: basename(path), ...probe(path) };
    },
    poster: (skill, file, seconds) => new Blob([readFileSync(posterOf(sampleFile(skill, file), seconds, dir))], { type: 'image/jpeg' }),
    log: (line) => console.log(line),
  }, { only: arg('only')?.split(','), force: has('force'), rebuild: REBUILD, dry: DRY });
} catch (error) {
  console.error(error.message);
} finally { rmSync(dir, { recursive: true, force: true }); }
process.exit(failed ? 1 : 0);
