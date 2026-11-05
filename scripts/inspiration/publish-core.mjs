// 灵感库示例的发布逻辑（docs/studio-inspiration-library.md）。Node 和浏览器共用，所以这里不碰文件系统：
// 素材、尺寸和静帧由调用方提供（publish.mjs 从磁盘读，browser.mjs 从本机 serve.mjs 取）。
//
// 走的都是现有接口：上传素材 → 建画布 → 存为官方内容 → 设封面和排序 → 删掉中转画布。
// 编号固定，重复执行是更新同一条，不会多出新条目。不调用任何模型，不扣积分。
//
// 已发布的条目默认只更新名称、说明、排序和上下线。force 才重建画布、换素材：服务端会删掉旧版素材副本，
// 而用户做同款得到的画布引用的正是那些文件，他们画布里的「示例效果」会打不开（我的版本和提示词不受影响）。

import { INSPIRATIONS, ratioOf } from './catalog.mjs';

const SKILL_OF_KIND = { image: 'image-generation', video: 'video-generation' };

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
export function buildDoc(item, uploaded, inputAsset) {
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

/**
 * @param host.base    后端地址；浏览器里传当前站点
 * @param host.token   () => 超级管理员令牌，每次请求现取（页面可能中途刷新令牌）
 * @param host.has     (skill, file) => 素材是否存在
 * @param host.sample  (skill, file) => { blob, name, width, height, seconds }
 * @param host.poster  (skill, file, seconds) => 静帧 Blob：卡片和弹窗用，取中段
 * @param host.log     (line) => void
 * @returns 失败条数
 */
export async function publishAll(host, { only, force = false, dry = false } = {}) {
  const { log } = host;
  async function api(path, init = {}) {
    const res = await fetch(`${host.base}/api/v1/ip-studio${path}`, {
      ...init, headers: { Authorization: `Bearer ${host.token()}`, ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = undefined; }
    if (!res.ok || body?.success === false) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${body?.error?.code || ''} ${body?.error?.message || text.slice(0, 200)}`);
    return body?.data;
  }
  const json = (method, payload) => ({ method, body: JSON.stringify(payload ?? {}) });
  const form = (blob, name, fields = {}) => {
    const body = new FormData();
    body.append('file', blob, name);
    for (const [key, value] of Object.entries(fields)) if (value) body.append(key, value);
    return { method: 'POST', body };
  };

  async function folderId() {
    const name = '灵感库示例素材';
    const folders = await api('/library/folders');
    return (folders.find((f) => f.name === name) || await api('/library/folders', json('POST', { name }))).id;
  }

  async function upload(skill, file, kind, folder) {
    const sample = await host.sample(skill, file);
    const done = await api('/library/uploads', form(sample.blob, sample.name, { mediaType: kind, folderId: folder }));
    return { key: done.key, mimeType: done.mimeType, bytes: done.bytes, width: sample.width, height: sample.height, seconds: sample.seconds };
  }

  async function publish(item, order, folder, existing) {
    const demoId = `IPD-insp-${item.id}`;
    const finish = async () => {
      await api(`/demos/${demoId}`, json('POST', { name: item.name, summary: item.summary, sortOrder: 100 + order }));
      await api(`/demos/${demoId}/enabled`, json('POST', { enabled: !item.hold }));
    };
    if (existing.has(demoId) && !force) {
      if (dry) { log(`[dry-run] ${demoId} ${item.name} 已发布，只更新名称和排序`); return; }
      await finish();
      log(`已更新 ${demoId} ${item.name}（只更新名称、说明、排序、上下线；换素材或提示词要加 force）`);
      return;
    }
    const input = item.input?.sample;
    for (const [skill, file] of [...item.samples.map((file) => [item.skill, file]), ...(input ? [[input.skill, input.file]] : [])]) {
      if (!await host.has(skill, file)) throw new Error(`素材不存在：${skill}/${file}`);
    }
    if (dry) { log(`[dry-run] ${demoId} ${item.name} ${item.samples.length} 个素材${item.hold ? '（下线）' : ''}`); return; }

    const uploaded = [];
    for (const file of item.samples) uploaded.push(await upload(item.skill, file, item.kind, folder));
    const inputAsset = input ? await upload(input.skill, input.file, 'image', folder) : undefined;

    const project = await api('/projects', json('POST', { name: item.name }));
    try {
      await api(`/projects/${project.id}`, json('PUT', { doc: buildDoc(item, uploaded, inputAsset), baseDocVersion: project.docVersion }));
      await api(`/projects/${project.id}/publish-as-demo`, json('POST', { demoId, name: item.name, summary: item.summary, kind: 'example' }));
    } finally {
      await api(`/projects/${project.id}`, { method: 'DELETE' }).catch((e) => log(`中转画布 ${project.id} 没有删掉：${e.message}`));
    }
    // 图片示例的封面就是示例图本身；视频要给一张静帧，否则卡片要先下载视频才有画面。
    if (item.kind === 'video') await api(`/covers/template/${demoId}`, form(await host.poster(item.skill, item.samples[0], uploaded[0].seconds), 'poster.jpg'));
    await finish();
    log(`已发布 ${demoId} ${item.name}${item.hold ? '（保持下线）' : ''}`);
  }

  const items = INSPIRATIONS.filter((item) => !only || only.includes(item.id));
  if (!items.length) throw new Error('没有匹配的条目');
  const folder = dry ? undefined : await folderId();
  const existing = new Set(dry ? [] : (await api('/demos')).map((row) => row.id));
  let failed = 0;
  for (const item of items) {
    try { await publish(item, INSPIRATIONS.indexOf(item), folder, existing); }
    catch (error) { failed++; log(`失败 ${item.id}：${error.message}`); }
  }
  log(`完成：${items.length - failed} 条成功，${failed} 条失败。`);
  return failed;
}
