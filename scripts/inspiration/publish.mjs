#!/usr/bin/env node
// 把 catalog.mjs 里的示例发布成灵感库的官方示例（docs/studio-inspiration-library.md）。
//
//   node scripts/inspiration/publish.mjs --base http://localhost:18181 --skills <resources/skills> [--only id,id] [--dry-run] [--force]
//
// 令牌从环境变量 STUDIO_TOKEN 读，必须是超级管理员（发布官方内容的既有要求）。不接受明文账号密码。
// 走的都是现有接口：上传素材 → 建画布 → 存为官方内容 → 设封面和排序 → 删掉中转画布。
// 编号固定，重复执行是更新同一条，不会多出新条目。不调用任何模型，不扣积分。
//
// 已发布的条目默认只更新名称、说明、排序和上下线。--force 才重建画布、换素材：服务端会删掉旧版素材副本，
// 而用户做同款得到的画布引用的正是那些文件，他们画布里的「示例效果」会打不开（我的版本和提示词不受影响）。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { INSPIRATIONS, ratioOf } from './catalog.mjs';

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);
const fail = (message) => { console.error(message); process.exit(1); };

const BASE = (arg('base') || fail('缺少 --base，例如 http://localhost:18181')).replace(/\/$/, '');
const SKILLS = arg('skills') || fail('缺少 --skills，指向本机的 resources/skills 目录');
const ONLY = arg('only')?.split(',');
const DRY = has('dry-run');
const FORCE = has('force');
const TOKEN = process.env.STUDIO_TOKEN || (DRY ? '' : fail('缺少环境变量 STUDIO_TOKEN（超级管理员令牌）'));

const SKILL_OF_KIND = { image: 'image-generation', video: 'video-generation' };
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
const ext = (file) => file.slice(file.lastIndexOf('.')).toLowerCase();
const sampleFile = (skill, file) => join(SKILLS, 'covers', 'by_skill_id', skill, file);

async function api(path, init = {}) {
  const res = await fetch(`${BASE}/api/v1/ip-studio${path}`, {
    ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = undefined; }
  if (!res.ok || body?.success === false) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${body?.error?.code || ''} ${body?.error?.message || text.slice(0, 200)}`);
  return body?.data;
}
const json = (method, payload) => ({ method, body: JSON.stringify(payload ?? {}) });
const form = (path, mime, fields = {}) => {
  const body = new FormData();
  body.append('file', new Blob([readFileSync(path)], { type: mime }), basename(path));
  for (const [key, value] of Object.entries(fields)) if (value) body.append(key, value);
  return { method: 'POST', body };
};

function probe(path) {
  const out = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path], { encoding: 'utf8' }));
  return { width: out.streams[0].width, height: out.streams[0].height, seconds: Number(out.format?.duration) || 0 };
}
/** 卡片和弹窗的静帧。取中段：第一帧常常是黑场，或者主体还没进画面。 */
function posterOf(path, seconds, dir) {
  const target = join(dir, `${basename(path)}.poster.jpg`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(seconds * 0.6), '-i', path, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', target]);
  return target;
}

/** 媒体卡片的尺寸：宽度随比例走，竖版窄一点，高度按比例算（头部约 44）。 */
function cardSize(ratio) {
  const width = ratio >= 1 ? 460 : 320;
  return { width, height: Math.round(width / ratio) + 44 };
}

const instructions = (item) => [
  item.summary, '',
  '这套做法',
  ...item.method.map((line) => `· ${line}`), '',
  '怎么用',
  `1. 打开「我的版本」，${item.replace}。`,
  ...(item.input ? [item.input.sample ? `2. 「${item.input.title}」里放的是示例图，可以换成你自己的${item.input.hint}。` : `2. 把${item.input.hint}放进「${item.input.title}」就会用作参考，不放也能生成。`] : []),
  `${item.input ? 3 : 2}. 点生成，或者直接发送助手输入框里填好的内容。生成前会显示所需积分。`,
].join('\n');

/** 示例画布：说明 / 素材 → 我的版本（提示词已填好，等着生成）→ 示例效果。 */
function buildDoc(item, uploaded, inputAsset) {
  const nodes = [], connections = [];
  const ratio = ratioOf(item.ratio), mine = cardSize(ratio), column = 380, gap = 80, guideHeight = 440;
  const verb = item.kind === 'video' ? '帮我生成这段视频：' : '帮我生成这张图：';
  nodes.push({ id: 'guide', type: 'text', title: '创作说明', position: { x: 0, y: 0 }, width: column, height: guideHeight,
    metadata: { content: instructions(item), prompt: item.request || `${verb}${item.prompt}`, studioStart: 'assistant', studioSkill: item.assistantSkill || SKILL_OF_KIND[item.kind], status: 'idle' } });
  if (item.input) {
    const width = column, height = inputAsset ? Math.round(width * inputAsset.height / inputAsset.width) + 44 : 280;
    nodes.push({ id: 'input', type: 'image', title: item.input.title, position: { x: 0, y: guideHeight + 40 }, width, height,
      metadata: inputAsset
        ? { storageKey: inputAsset.key, status: 'success', origin: 'example', mimeType: inputAsset.mimeType, naturalWidth: inputAsset.width, naturalHeight: inputAsset.height, size: `${inputAsset.width}x${inputAsset.height}` }
        // 选填：空着不挡生成，放了图才当参考（studio-linked-inputs.ts）。
        : { status: 'idle', studio: { templateInput: { required: false, label: item.input.title } } } });
    connections.push({ id: 'c-input', fromNodeId: 'input', toNodeId: 'mine' });
  }
  nodes.push({ id: 'mine', type: item.kind, title: '我的版本', position: { x: column + gap, y: 0 }, width: mine.width, height: mine.height,
    metadata: { prompt: item.prompt, size: item.ratio, ...(item.kind === 'video' ? { seconds: item.seconds } : { count: 1 }), status: 'idle' } });
  let x = column + gap + mine.width + gap;
  uploaded.forEach((sample, index) => {
    const size = cardSize(sample.width / sample.height);
    nodes.push({ id: `sample-${index + 1}`, type: item.kind, title: uploaded.length > 1 ? `示例效果 ${index + 1}` : '示例效果', position: { x, y: 0 }, width: size.width, height: size.height,
      metadata: { storageKey: sample.key, status: 'success', origin: 'example', prompt: item.prompt, mimeType: sample.mimeType, bytes: sample.bytes, naturalWidth: sample.width, naturalHeight: sample.height,
        ...(item.kind === 'video' ? { size: item.ratio, seconds: Math.round(sample.seconds), durationMs: Math.round(sample.seconds * 1000) } : { size: `${sample.width}x${sample.height}` }) } });
    x += size.width + gap;
  });
  // 助手默认停靠在一侧，打开时让开左栏，尽量一眼看全：1440 宽的窗口去掉助手和左栏后约 900。
  const total = x - gap, k = Math.min(0.72, Math.round(840 / total * 100) / 100);
  return { nodes, connections, viewport: { x: 76, y: 76, k } };
}

async function folderId() {
  const name = '灵感库示例素材';
  const folders = await api('/library/folders');
  return (folders.find((f) => f.name === name) || await api('/library/folders', json('POST', { name }))).id;
}

async function upload(path, kind, folder) {
  const done = await api('/library/uploads', form(path, MIME[ext(path)], { mediaType: kind, folderId: folder }));
  const size = probe(path);
  return { key: done.key, mimeType: done.mimeType, bytes: done.bytes, ...size };
}

async function publish(item, order, folder, dir, existing) {
  const demoId = `IPD-insp-${item.id}`;
  const finish = async () => {
    await api(`/demos/${demoId}`, json('POST', { name: item.name, summary: item.summary, sortOrder: 100 + order }));
    await api(`/demos/${demoId}/enabled`, json('POST', { enabled: !item.hold }));
  };
  if (existing.has(demoId) && !FORCE) {
    if (DRY) { console.log(`[dry-run] ${demoId} ${item.name} 已发布，只更新名称和排序`); return; }
    await finish();
    console.log(`已更新 ${demoId} ${item.name}（只更新名称、说明、排序、上下线；换素材或提示词要加 --force）`);
    return;
  }
  const paths = item.samples.map((file) => sampleFile(item.skill, file));
  const inputPath = item.input?.sample ? sampleFile(item.input.sample.skill, item.input.sample.file) : undefined;
  for (const path of [...paths, ...(inputPath ? [inputPath] : [])]) if (!existsSync(path)) throw new Error(`素材不存在：${path}`);
  if (DRY) { console.log(`[dry-run] ${demoId} ${item.name} ${paths.length} 个素材${item.hold ? '（下线）' : ''}`); return; }

  const uploaded = [];
  for (const path of paths) uploaded.push(await upload(path, item.kind, folder));
  const inputAsset = inputPath ? await upload(inputPath, 'image', folder) : undefined;

  const project = await api('/projects', json('POST', { name: item.name }));
  try {
    await api(`/projects/${project.id}`, json('PUT', { doc: buildDoc(item, uploaded, inputAsset), baseDocVersion: project.docVersion }));
    await api(`/projects/${project.id}/publish-as-demo`, json('POST', { demoId, name: item.name, summary: item.summary, kind: 'example' }));
  } finally {
    await api(`/projects/${project.id}`, { method: 'DELETE' }).catch((e) => console.warn(`中转画布 ${project.id} 没有删掉：${e.message}`));
  }
  // 图片示例的封面就是示例图本身；视频要给一张静帧，否则卡片要先下载视频才有画面。
  if (item.kind === 'video') await api(`/covers/template/${demoId}`, form(posterOf(paths[0], uploaded[0].seconds, dir), 'image/jpeg'));
  await finish();
  console.log(`已发布 ${demoId} ${item.name}${item.hold ? '（保持下线）' : ''}`);
}

const items = INSPIRATIONS.filter((item) => !ONLY || ONLY.includes(item.id));
if (!items.length) fail('没有匹配的条目');
const dir = mkdtempSync(join(tmpdir(), 'inspiration-'));
let failed = 0;
try {
  const folder = DRY ? undefined : await folderId();
  const existing = new Set(DRY ? [] : (await api('/demos')).map((row) => row.id));
  for (const [order, item] of items.entries()) {
    try { await publish(item, INSPIRATIONS.indexOf(item), folder, dir, existing); }
    catch (error) { failed++; console.error(`失败 ${item.id}：${error.message}`); }
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(`完成：${items.length - failed} 条成功，${failed} 条失败。`);
process.exit(failed ? 1 : 0);
